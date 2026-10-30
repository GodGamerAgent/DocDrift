import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { analyzeLocalDirectory, analyzeSampleRepo } from '@/lib/analyzer';
import { SAMPLE_REPOS } from '@/lib/sampleRepos';

const execFileAsync = promisify(execFile);
const GITHUB_NAME = /^[A-Za-z0-9_.-]+$/;

// Accepts https://github.com/owner/repo (optionally with .git, a trailing path like /tree/main,
// or no scheme) and rebuilds a canonical clone URL so nothing user-controlled reaches git verbatim.
function parseGitHubUrl(input: string): { cloneUrl: string; repoName: string } | null {
  let raw = input.trim();
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (!['github.com', 'www.github.com'].includes(url.hostname.toLowerCase())) return null;
  if (url.username || url.password || url.port) return null;

  const [owner, rawRepo] = url.pathname.split('/').filter(Boolean);
  const repo = rawRepo?.replace(/\.git$/, '');
  if (!owner || !repo) return null;
  if (![owner, repo].every((part) => GITHUB_NAME.test(part) && !/^\.+$/.test(part))) return null;

  return { cloneUrl: `https://github.com/${owner}/${repo}.git`, repoName: `${owner}/${repo}` };
}

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON' }, { status: 400 });
  }

  try {
    const { repoUrl, sampleId } = body ?? {};

    // 1. If sample repo requested
    if (sampleId !== undefined) {
      if (typeof sampleId !== 'string' || !SAMPLE_REPOS[sampleId]) {
        return NextResponse.json({ error: `Unknown sample repository: ${String(sampleId)}` }, { status: 400 });
      }
      const result = await analyzeSampleRepo(sampleId);
      return NextResponse.json(result);
    }

    // 2. If GitHub URL requested
    if (typeof repoUrl !== 'string' || !repoUrl.trim()) {
      return NextResponse.json({ error: 'Provide a repoUrl or sampleId.' }, { status: 400 });
    }

    const parsed = parseGitHubUrl(repoUrl);
    if (!parsed) {
      return NextResponse.json(
        { error: 'Invalid URL. Please enter a valid public GitHub repository URL (e.g., https://github.com/expressjs/express).' },
        { status: 400 }
      );
    }

    // Create isolated temporary directory
    const cloneDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docdrift-'));

    try {
      console.log(`[DocDrift] Cloning ${parsed.cloneUrl} into ${cloneDir}...`);
      try {
        // execFile (no shell) + `--` keeps the URL from being interpreted as a command or git option.
        // GIT_TERMINAL_PROMPT=0 makes private repos fail fast instead of waiting for credentials.
        await execFileAsync(
          'git',
          ['clone', '--depth', '1', '--single-branch', '--no-tags', '--', parsed.cloneUrl, cloneDir],
          { timeout: 60000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } }
        );
      } catch (cloneErr: any) {
        console.error('Git clone failed:', cloneErr.stderr || cloneErr.message);
        const reason = cloneErr.killed
          ? 'the clone timed out'
          : /not found|could not read Username|Authentication failed/i.test(cloneErr.stderr || '')
          ? 'the repository is private or does not exist'
          : 'git could not fetch it';
        return NextResponse.json(
          { error: `Failed to clone ${parsed.repoName}: ${reason}. Try one of the built-in showcase repos!` },
          { status: 502 }
        );
      }

      const result = await analyzeLocalDirectory(cloneDir, parsed.repoName, `https://github.com/${parsed.repoName}`);
      return NextResponse.json(result);
    } finally {
      fs.promises.rm(cloneDir, { recursive: true, force: true }).catch(() => {});
    }
  } catch (err: any) {
    console.error('Scan API error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
