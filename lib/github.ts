import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const API = 'https://api.github.com';

export interface GitHubStatus {
  connected: boolean;
  login?: string;
  source?: 'GITHUB_TOKEN' | 'gh CLI';
  error?: string;
}

class GitHubError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

// The token never comes from the browser: GITHUB_TOKEN, else the machine's `gh auth` login.
async function getToken(): Promise<{ token: string; source: GitHubStatus['source'] } | null> {
  if (process.env.GITHUB_TOKEN) return { token: process.env.GITHUB_TOKEN, source: 'GITHUB_TOKEN' };
  try {
    const { stdout } = await execFileAsync('gh', ['auth', 'token'], { timeout: 5000 });
    const token = stdout.trim();
    return token ? { token, source: 'gh CLI' } : null;
  } catch {
    return null;
  }
}

async function api<T = any>(token: string, method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'DocDrift',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new GitHubError(data.message || `GitHub returned ${res.status}`, res.status);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export async function getGitHubStatus(): Promise<GitHubStatus> {
  const auth = await getToken();
  if (!auth) return { connected: false, error: 'No GitHub credentials. Set GITHUB_TOKEN or run `gh auth login`.' };
  try {
    const user = await api(auth.token, 'GET', '/user');
    return { connected: true, login: user.login, source: auth.source };
  } catch (err: any) {
    return { connected: false, source: auth.source, error: err.message };
  }
}

const encodePath = (filePath: string) => filePath.split('/').map(encodeURIComponent).join('/');
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function createReadmePullRequest({
  repo,
  filePath,
  content,
  title,
  body,
}: {
  repo: string; // owner/name
  filePath: string;
  content: string;
  title: string;
  body: string;
}): Promise<{ url: string; number: number; branch: string; viaFork: boolean }> {
  const auth = await getToken();
  if (!auth) throw new Error('No GitHub credentials. Set GITHUB_TOKEN or run `gh auth login`, then try again.');
  const { token } = auth;

  const upstream = await api(token, 'GET', `/repos/${repo}`);
  const base: string = upstream.default_branch;
  const baseSha: string = (await api(token, 'GET', `/repos/${repo}/git/ref/heads/${encodeURIComponent(base)}`)).object.sha;

  // Without push access, work on the user's fork (created if needed) and open the PR from there
  let target = repo;
  const viaFork = !upstream.permissions?.push;
  if (viaFork) {
    const fork = await api(token, 'POST', `/repos/${repo}/forks`, { default_branch_only: true });
    target = fork.full_name;
    // Forks are created asynchronously
    for (let attempt = 0; ; attempt++) {
      try {
        await api(token, 'GET', `/repos/${target}/git/ref/heads/${encodeURIComponent(fork.default_branch || base)}`);
        break;
      } catch (err) {
        if (attempt >= 15) throw new Error('Timed out waiting for GitHub to create your fork. Try again in a minute.');
        await sleep(2000);
      }
    }
  }

  const branch = `docdrift/readme-${Date.now().toString(36)}`;
  await api(token, 'POST', `/repos/${target}/git/refs`, { ref: `refs/heads/${branch}`, sha: baseSha });

  let fileSha: string | undefined;
  try {
    fileSha = (await api(token, 'GET', `/repos/${target}/contents/${encodePath(filePath)}?ref=${encodeURIComponent(branch)}`)).sha;
  } catch (err) {
    if (!(err instanceof GitHubError && err.status === 404)) throw err;
  }

  await api(token, 'PUT', `/repos/${target}/contents/${encodePath(filePath)}`, {
    message: title,
    content: Buffer.from(content, 'utf-8').toString('base64'),
    branch,
    ...(fileSha ? { sha: fileSha } : {}),
  });

  const pr = await api(token, 'POST', `/repos/${repo}/pulls`, {
    title,
    body,
    head: viaFork ? `${target.split('/')[0]}:${branch}` : branch,
    base,
    maintainer_can_modify: true,
  });

  return { url: pr.html_url, number: pr.number, branch, viaFork };
}
