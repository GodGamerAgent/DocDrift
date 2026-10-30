import fs from 'fs';
import path from 'path';
import { DriftItem, DriftCategory, DriftSeverity, RepoAnalysisResult } from './types';
import { checkLMStudioHealth, queryGemmaLMStudio } from './lmstudio';
import { calculateMetrics } from './metrics';
import { DRIFT_SYSTEM_PROMPT } from './prompts';
import { SAMPLE_REPOS } from './sampleRepos';

export interface CodeBlockDoc {
  language: string;
  code: string;
  file: string;
  startLine: number;
  endLine: number;
}

const SEVERITIES: DriftSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const CATEGORIES: DriftCategory[] = [
  'CLI_FLAG',
  'FUNCTION_SIGNATURE',
  'ENV_VARIABLE',
  'API_ENDPOINT',
  'INSTALL_STEP',
  'VERSION_MISMATCH',
];

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '__pycache__', '.next', 'vendor', 'target', 'venv', '.venv']);
const LOCK_FILES = new Set(['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'cargo.lock', 'poetry.lock', 'composer.lock']);
const MAX_CODE_FILES = 300;
const MAX_CODE_FILE_BYTES = 200_000;
const MAX_HEURISTIC_DRIFTS_PER_KIND = 10;

// Shell code-block languages whose commands may document the project's own CLI.
const SHELL_LANGS = new Set(['', 'bash', 'sh', 'shell', 'zsh', 'console', 'terminal', 'cmd', 'powershell', 'ps1']);
// Flags passed to these tools belong to the tool, not to the project's CLI.
const THIRD_PARTY_COMMANDS = new Set([
  'npm', 'npx', 'yarn', 'pnpm', 'bun', 'pip', 'pip3', 'pipx', 'uv', 'poetry', 'conda', 'git', 'gh', 'docker',
  'docker-compose', 'podman', 'kubectl', 'helm', 'curl', 'wget', 'brew', 'apt', 'apt-get', 'yum', 'dnf',
  'cargo', 'rustup', 'go', 'make', 'cd', 'ls', 'cp', 'mv', 'rm', 'mkdir', 'chmod', 'export', 'source', 'echo',
]);
const CLI_PARSER_PATTERN = /\.(?:option|requiredOption)\(|add_argument\(|click\.option|@click\.|\bflag\.(?:String|Int|Bool|Duration)\(|\.Flags\(\)|#\[arg|yargs|\bcobra\b|clap::/;
// Runtime/platform variables that READMEs rarely (and need not) document.
const IGNORED_ENV_VARS = new Set(['NODE_ENV', 'PATH', 'HOME', 'USER', 'CI', 'PWD', 'TMPDIR', 'SHELL', 'TERM', 'DEBUG', 'LANG', 'NEXT_RUNTIME', 'VERCEL', 'VERCEL_URL', 'VERCEL_ENV', 'GITLAB_CI', 'CIRCLECI', 'TRAVIS', 'BUILDKITE']);
// Set by CI platforms rather than by contributors
const CI_ENV_PREFIXES = ['GITHUB_ACTIONS', 'ACTIONS_', 'RUNNER_', 'CI_'];
const TEST_PATH = /(^|\/)(test|tests|__tests__|spec|specs|fixtures?|examples?)\/|\.(test|spec)\.[a-z]+$/i;
const ENV_PATTERNS = [
  /process\.env\.([A-Z_][A-Z0-9_]*)/g,
  /process\.env\[['"]([A-Z_][A-Z0-9_]*)['"]\]/g,
  /os\.environ\[['"]([A-Z_][A-Z0-9_]*)['"]\]/g,
  /os\.environ\.get\(\s*['"]([A-Z_][A-Z0-9_]*)['"]/g,
  /os\.getenv\(\s*['"]([A-Z_][A-Z0-9_]*)['"]/g,
  /os\.Getenv\(\s*"([A-Z_][A-Z0-9_]*)"\s*\)/g,
  /env::var\(\s*"([A-Z_][A-Z0-9_]*)"\s*\)/g,
];

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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findLineNumber(content: string, needle: string): number | null {
  const idx = content.indexOf(needle);
  if (idx === -1) return null;
  return content.slice(0, idx).split('\n').length;
}

// Extracts the JSON array from a model response, tolerating fences or surrounding prose.
function parseDriftJson(text: string): unknown[] | null {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end < start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// Model output is untrusted: coerce every field so the UI never renders undefined
// values and every drift has a unique id (ids are React keys and resolve targets).
function normalizeDrifts(raw: unknown[], readmeFile: string): DriftItem[] {
  const seen = new Set<string>();
  const str = (value: unknown, fallback = '') =>
    typeof value === 'string' ? value : value == null ? fallback : JSON.stringify(value);

  return raw
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item))
    .map((item, i) => {
      const severity = str(item.severity).toUpperCase() as DriftSeverity;
      const category = str(item.category).toUpperCase() as DriftCategory;
      let id = str(item.id) || `drift-${i + 1}`;
      while (seen.has(id)) id = `${id}-${i + 1}`;
      seen.add(id);

      return {
        id,
        title: str(item.title, 'Documentation drift'),
        category: CATEGORIES.includes(category) ? category : 'INSTALL_STEP',
        severity: SEVERITIES.includes(severity) ? severity : 'MEDIUM',
        docFile: str(item.docFile, readmeFile),
        docLineRange: str(item.docLineRange),
        codeFile: str(item.codeFile),
        codeLineRange: str(item.codeLineRange),
        docSnippet: str(item.docSnippet),
        codeSnippet: str(item.codeSnippet),
        explanation: str(item.explanation),
        newcomerImpact: str(item.newcomerImpact),
        suggestedDocFix: str(item.suggestedDocFix),
        resolved: false,
      };
    });
}

function detectHeuristicDrifts(
  readmeContent: string,
  readmeFile: string,
  codeFiles: { file: string; content: string }[]
): DriftItem[] {
  const drifts: DriftItem[] = [];

  // 1. CLI flags documented in shell snippets that the project's CLI parser does not define
  const parserFile = codeFiles.find((c) => CLI_PARSER_PATTERN.test(c.content));
  if (parserFile) {
    const codeAll = codeFiles.map((c) => c.content).join('\n');
    const seenFlags = new Set<string>();
    const blocks = extractMarkdownCodeBlocks(readmeContent, readmeFile).filter((b) =>
      SHELL_LANGS.has(b.language.toLowerCase())
    );

    for (const block of blocks) {
      const lines = block.code.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim().replace(/^\$\s+/, '').replace(/^sudo\s+/, '');
        if (!line || line.startsWith('#')) continue;
        const command = line.split(/\s+/)[0];
        if (THIRD_PARTY_COMMANDS.has(command)) continue;

        for (const match of Array.from(line.matchAll(/(?:^|\s)--([a-zA-Z0-9][a-zA-Z0-9_-]*)/g))) {
          const flag = match[1];
          if (['help', 'version', 'verbose'].includes(flag) || seenFlags.has(flag)) continue;
          seenFlags.add(flag);

          // Commander/argparse/clap spell out `--flag`; Go's flag pkg, click and yargs use the bare quoted name.
          const defined =
            codeAll.includes(`--${flag}`) || new RegExp(`["'\`]${escapeRegExp(flag)}["'\`]`).test(codeAll);
          if (defined || drifts.length >= MAX_HEURISTIC_DRIFTS_PER_KIND) continue;

          const docLine = block.startLine + 1 + i;
          drifts.push({
            id: `drift-flag-${flag}`,
            title: `Documented flag \`--${flag}\` not defined in CLI`,
            category: 'CLI_FLAG',
            severity: 'HIGH',
            docFile: readmeFile,
            docLineRange: `L${docLine}`,
            codeFile: parserFile.file,
            codeLineRange: 'CLI options definition',
            docSnippet: lines[i].trim(),
            codeSnippet: `// No definition of --${flag} found in the scanned CLI sources`,
            explanation: `README instructs contributors to invoke the CLI with \`--${flag}\`, but no CLI option named \`${flag}\` is defined in the scanned code.`,
            newcomerImpact: `Contributors running this command will likely receive an "unknown option" error.`,
            suggestedDocFix: `Remove \`--${flag}\` from the README command or replace it with the current option name.`,
            resolved: false,
          });
        }
      }
    }
  }

  // 2. Environment variables read by code but never mentioned in the README
  const envSources = new Map<string, { file: string; line: number | null; snippet: string }>();
  for (const { file, content } of codeFiles) {
    if (TEST_PATH.test(file)) continue;
    const isEnvExample = /(^|\/)\.env\.(example|sample|template)$/i.test(file);
    const patterns = isEnvExample ? [/^([A-Z_][A-Z0-9_]*)=/gm] : ENV_PATTERNS;
    for (const pattern of patterns) {
      for (const match of Array.from(content.matchAll(pattern))) {
        const name = match[1];
        if (envSources.has(name) || IGNORED_ENV_VARS.has(name)) continue;
        if (CI_ENV_PREFIXES.some((prefix) => name.startsWith(prefix))) continue;
        envSources.set(name, { file, line: findLineNumber(content, match[0]), snippet: match[0] });
      }
    }
  }

  let envDrifts = 0;
  for (const [name, source] of Array.from(envSources)) {
    if (new RegExp(`\\b${escapeRegExp(name)}\\b`).test(readmeContent)) continue;
    if (envDrifts++ >= MAX_HEURISTIC_DRIFTS_PER_KIND) break;
    drifts.push({
      id: `drift-env-${name}`,
      title: `Environment Variable \`${name}\` Missing from README`,
      category: 'ENV_VARIABLE',
      severity: 'MEDIUM',
      docFile: readmeFile,
      docLineRange: 'Environment Setup',
      codeFile: source.file,
      codeLineRange: source.line ? `L${source.line}` : '',
      docSnippet: '// Not documented in README',
      codeSnippet: source.snippet,
      explanation: `Code reads \`${name}\`, but the README never mentions it.`,
      newcomerImpact: `Contributors won't know to set \`${name}\`; the app may fail on first boot or silently fall back to a default.`,
      suggestedDocFix: `${name}=<value>`,
      resolved: false,
    });
  }

  return drifts;
}

// Files most likely to define the public surface (CLI, env, routes) go to the model first.
function codeFilePriority(file: string, content: string): number {
  let score = 0;
  if (CLI_PARSER_PATTERN.test(content)) score += 4;
  if (ENV_PATTERNS.some((p) => new RegExp(p.source).test(content))) score += 2;
  if (/\.env\.(example|sample|template)$/i.test(file)) score += 3;
  if (/(^|\/)(cli|main|index|app|server|routes?)\.[a-z]+$/i.test(file)) score += 2;
  if (TEST_PATH.test(file)) score -= 3;
  return score - file.split('/').length * 0.1;
}

export async function analyzeLocalDirectory(
  repoPath: string,
  repoName: string,
  repoUrl?: string
): Promise<RepoAnalysisResult> {
  const docsScanned: string[] = [];
  const codeFilesScanned: string[] = [];

  // 1. Gather all files (Dirent.isFile/isDirectory are false for symlinks, so links are never followed)
  function scanDir(dir: string, depth = 0) {
    if (depth > 5) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') && !/^\.env\.(example|sample|template)$/i.test(entry.name)) continue;
        if (SKIP_DIRS.has(entry.name)) continue;

        const fullPath = path.join(dir, entry.name);
        const relPath = path.relative(repoPath, fullPath).split(path.sep).join('/');

        if (entry.isDirectory()) {
          scanDir(fullPath, depth + 1);
        } else if (entry.isFile()) {
          const lower = entry.name.toLowerCase();
          if (lower.endsWith('.md') || lower === 'readme' || lower.endsWith('.markdown')) {
            docsScanned.push(relPath);
          } else if (
            !LOCK_FILES.has(lower) &&
            (/\.(js|mjs|cjs|ts|jsx|tsx|py|go|rs|json|sh)$/.test(lower) || /^\.env\./.test(lower))
          ) {
            codeFilesScanned.push(relPath);
          }
        }
      }
    } catch (e) {
      console.warn(`Error scanning dir ${dir}:`, e);
    }
  }

  scanDir(repoPath);

  // Prefer the root README over nested ones (docs/README.md, examples/*/README.md, ...)
  let readmeContent = '';
  const readmes = docsScanned.filter((d) => path.basename(d).toLowerCase().startsWith('readme'));
  const readmeFile = readmes.find((d) => !d.includes('/')) || readmes[0] || docsScanned[0] || 'README.md';
  if (docsScanned.length > 0) {
    try {
      readmeContent = fs.readFileSync(path.join(repoPath, readmeFile), 'utf-8');
    } catch (e) {
      console.warn('Failed to read readme file:', e);
    }
  }

  const codeFiles: { file: string; content: string }[] = [];
  for (const cFile of codeFilesScanned.slice(0, MAX_CODE_FILES)) {
    try {
      const fullPath = path.join(repoPath, cFile);
      if (fs.statSync(fullPath).size > MAX_CODE_FILE_BYTES) continue;
      codeFiles.push({ file: cFile, content: fs.readFileSync(fullPath, 'utf-8') });
    } catch (e) {
      // skip unreadable files
    }
  }

  let foundDrifts: DriftItem[] | null = null;
  let modelUsed = 'Rule-based fallback (LM Studio offline)';
  let inferenceMode: RepoAnalysisResult['inferenceMode'] = 'GEMMA_LOCAL_SIMULATOR';

  // Live AI drift detection with Gemma when LM Studio is reachable
  const lmStatus = await checkLMStudioHealth();
  if (lmStatus.connected && readmeContent) {
    const promptFiles = [...codeFiles]
      .sort((a, b) => codeFilePriority(b.file, b.content) - codeFilePriority(a.file, a.content))
      .slice(0, 8);

    const prompt = `Analyze this repository's documentation and code to identify Documentation Drift (outdated flags, changed API routes, renamed methods, missing env vars, broken quickstart steps).

README (${readmeFile}):
${readmeContent.slice(0, 3500)}

Codebase Snippets:
${promptFiles.map((c) => `--- File: ${c.file} ---\n${c.content.slice(0, 1500)}`).join('\n\n')}

Return a JSON array of drift items with this exact schema:
[
  {
    "id": "drift-1",
    "title": "Short title describing the drift",
    "category": "CLI_FLAG | FUNCTION_SIGNATURE | ENV_VARIABLE | API_ENDPOINT | INSTALL_STEP | VERSION_MISMATCH",
    "severity": "CRITICAL | HIGH | MEDIUM | LOW",
    "docFile": "${readmeFile}",
    "docLineRange": "L10-L15",
    "codeFile": "path/to/code.ts",
    "codeLineRange": "L20-L25",
    "docSnippet": "exact outdated code or command from README",
    "codeSnippet": "actual current code signature or definition",
    "explanation": "why this is drifted and what changed in code",
    "newcomerImpact": "how a new contributor or user will fail if they follow the docs",
    "suggestedDocFix": "the exact corrected instruction (for ENV_VARIABLE drifts: NAME=<value> lines)"
  }
]
`;

    try {
      const gemmaResponse = await queryGemmaLMStudio({
        model: lmStatus.model,
        messages: [
          { role: 'system', content: DRIFT_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        maxTokens: 4000,
      });

      const parsed = parseDriftJson(gemmaResponse.content);
      if (parsed) {
        foundDrifts = normalizeDrifts(parsed, readmeFile);
        inferenceMode = 'LM_STUDIO_LIVE';
        modelUsed = `${gemmaResponse.model} (LM Studio)`;
      } else {
        console.warn('[DocDrift] Model response was not a JSON array; using rule-based fallback.');
      }
    } catch (err) {
      // Fall through to the rule-based detector below
    }
  }

  if (!foundDrifts) {
    foundDrifts = detectHeuristicDrifts(readmeContent, readmeFile, codeFiles);
    if (lmStatus.connected) modelUsed = 'Rule-based fallback (model response unusable)';
  }

  const metrics = calculateMetrics(foundDrifts);
  let summary = 'Documentation is in sync with codebase! No major drift detected.';
  if (!readmeContent) {
    summary = 'No README found in this repository, so there is no documentation to check for drift.';
  } else if (foundDrifts.length > 0) {
    summary = `Found ${foundDrifts.length} documentation drift${foundDrifts.length === 1 ? '' : 's'} (${metrics.criticalCount} critical). New contributors following the README are likely to hit setup failures.`;
  }

  return {
    repoName,
    repoUrl,
    isSample: false,
    totalFilesScanned: docsScanned.length + codeFilesScanned.length,
    docsScanned,
    codeFilesScanned,
    metrics,
    drifts: foundDrifts,
    modelUsed,
    inferenceMode,
    analyzedAt: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    summary,
    readmeFile: readmeContent ? readmeFile : undefined,
    readmeContent: readmeContent || undefined,
  };
}

export async function analyzeSampleRepo(sampleId: string): Promise<RepoAnalysisResult> {
  const sample = SAMPLE_REPOS[sampleId] || SAMPLE_REPOS['deployx-cli'];

  // Calculate realistic metrics
  const metrics = calculateMetrics(sample.expectedDrifts);

  // Showcase drifts are precomputed; report whether a live model is available
  const lmStatus = await checkLMStudioHealth();

  return {
    repoName: sample.name,
    repoUrl: `https://github.com/${sample.name}`,
    isSample: true,
    sampleId: sample.id,
    totalFilesScanned: 1 + Object.keys(sample.codeFiles).length,
    docsScanned: ['README.md'],
    codeFilesScanned: Object.keys(sample.codeFiles),
    metrics,
    drifts: sample.expectedDrifts,
    modelUsed: lmStatus.connected ? `${lmStatus.model} (LM Studio)` : 'Gemma 4 12B (showcase, LM Studio offline)',
    inferenceMode: lmStatus.connected ? 'LM_STUDIO_LIVE' : 'GEMMA_LOCAL_SIMULATOR',
    analyzedAt: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    summary: `Detected ${sample.expectedDrifts.length} drift points (${metrics.criticalCount} critical). Onboarding a new contributor currently takes ~${metrics.estimatedOnboardingFrictionMin} min of troubleshooting.`,
  };
}
