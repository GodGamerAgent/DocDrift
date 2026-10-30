import { DriftItem } from '../types';

export interface CodeFile {
  file: string;
  content: string;
}

export interface CodeBlockDoc {
  language: string;
  code: string;
  file: string;
  startLine: number;
  endLine: number;
}

// Shell code-block languages whose commands may document the project's own CLI.
export const SHELL_LANGS = new Set(['', 'bash', 'sh', 'shell', 'zsh', 'console', 'terminal', 'cmd', 'powershell', 'ps1']);
// Flags passed to these tools belong to the tool, not to the project's CLI.
export const THIRD_PARTY_COMMANDS = new Set([
  'npm', 'npx', 'yarn', 'pnpm', 'bun', 'pip', 'pip3', 'pipx', 'uv', 'poetry', 'conda', 'git', 'gh', 'docker',
  'docker-compose', 'podman', 'kubectl', 'helm', 'curl', 'wget', 'brew', 'apt', 'apt-get', 'yum', 'dnf',
  'cargo', 'rustup', 'go', 'make', 'cd', 'ls', 'cp', 'mv', 'rm', 'mkdir', 'chmod', 'export', 'source', 'echo',
]);
export const CLI_PARSER_PATTERN = /\.(?:option|requiredOption)\(|add_argument\(|click\.option|@click\.|\bflag\.(?:String|Int|Bool|Duration)\(|\.Flags\(\)|#\[arg|yargs|\bcobra\b|clap::/;
export const TEST_PATH = /(^|\/)(test|tests|__tests__|spec|specs|fixtures?|examples?)\/|\.(test|spec)\.[a-z]+$/i;

// Each heuristic kind is capped so one noisy repo can't flood the issue list.
export const MAX_ITEMS_PER_KIND = 10;

export function extractMarkdownCodeBlocks(content: string, filePath: string): CodeBlockDoc[] {
  const blocks: CodeBlockDoc[] = [];
  const lines = content.split('\n');
  let inBlock = false;
  let currentLang = '';
  let currentCode: string[] = [];
  let startLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('```')) {
      if (!inBlock) {
        inBlock = true;
        currentLang = line.trim().replace(/^```/, '').trim();
        startLine = i + 1;
        currentCode = [];
      } else {
        inBlock = false;
        blocks.push({
          language: currentLang,
          code: currentCode.join('\n'),
          file: filePath,
          startLine,
          endLine: i + 1,
        });
      }
    } else if (inBlock) {
      currentCode.push(line);
    }
  }

  return blocks;
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function findLineNumber(content: string, needle: string): number | null {
  const idx = content.indexOf(needle);
  if (idx === -1) return null;
  return content.slice(0, idx).split('\n').length;
}

// Shared defaults so every rule-based check only fills in what it knows.
export function makeDrift(fields: Partial<DriftItem> & Pick<DriftItem, 'id' | 'title' | 'category' | 'severity'>): DriftItem {
  return {
    docFile: 'README.md',
    docLineRange: '',
    codeFile: '',
    codeLineRange: '',
    docSnippet: '',
    codeSnippet: '',
    explanation: '',
    newcomerImpact: '',
    suggestedDocFix: '',
    resolved: false,
    ...fields,
  };
}
