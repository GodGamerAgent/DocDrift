import fs from 'fs';
import path from 'path';
import { DocTarget, DriftItem, DriftCategory, DriftSeverity, RepoAnalysisResult } from './types';
import { checkLMStudioHealth, queryGemmaLMStudio } from './lmstudio';
import { calculateMetrics } from './metrics';
import { Settings } from './settingsSchema';
import { SAMPLE_REPOS } from './sampleRepos';
import { CLI_PARSER_PATTERN, CodeFile, MAX_ITEMS_PER_KIND, TEST_PATH, escapeRegExp, findLineNumber, makeDrift } from './checks/common';
import { auditCliFlags } from './checks/cliFlags';
import { auditApiDocs, synthesizeApiDocForRepo } from './checks/apiDocs';
import { checkLinks } from './checks/links';
import { findSecrets } from './checks/secrets';
import { checkLicense } from './checks/license';

const SEVERITIES: DriftSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const CATEGORIES: DriftCategory[] = [
  'CLI_FLAG',
  'FUNCTION_SIGNATURE',
  'ENV_VARIABLE',
  'API_ENDPOINT',
  'INSTALL_STEP',
  'VERSION_MISMATCH',
  'DEAD_LINK',
  'SECRET_LEAK',
  'LICENSE_MISMATCH',
];

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '__pycache__', '.next', 'vendor', 'target', 'venv', '.venv']);
const LOCK_FILES = new Set(['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'cargo.lock', 'poetry.lock', 'composer.lock']);
// Runtime/platform variables that READMEs rarely (and need not) document.
const IGNORED_ENV_VARS = new Set(['NODE_ENV', 'PATH', 'HOME', 'USER', 'CI', 'PWD', 'TMPDIR', 'SHELL', 'TERM', 'DEBUG', 'LANG', 'NEXT_RUNTIME', 'VERCEL', 'VERCEL_URL', 'VERCEL_ENV', 'GITLAB_CI', 'CIRCLECI', 'TRAVIS', 'BUILDKITE']);
// Set by CI platforms rather than by contributors
const CI_ENV_PREFIXES = ['GITHUB_ACTIONS', 'ACTIONS_', 'RUNNER_', 'CI_'];
const ENV_PATTERNS = [
  /process\.env\.([A-Z_][A-Z0-9_]*)/g,
  /process\.env\[['"]([A-Z_][A-Z0-9_]*)['"]\]/g,
  /os\.environ\[['"]([A-Z_][A-Z0-9_]*)['"]\]/g,
  /os\.environ\.get\(\s*['"]([A-Z_][A-Z0-9_]*)['"]/g,
  /os\.getenv\(\s*['"]([A-Z_][A-Z0-9_]*)['"]/g,
  /os\.Getenv\(\s*"([A-Z_][A-Z0-9_]*)"\s*\)/g,
  /env::var\(\s*"([A-Z_][A-Z0-9_]*)"\s*\)/g,
];

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

function inferEnvExampleValue(name: string, lineText: string): string {
  // Check if the code line has a fallback like `process.env.PORT || 3000` or `os.getenv("HOST", "localhost")`
  const fallbackMatch =
    lineText.match(/(?:\|\||\?\?)\s*(['"`]?)([A-Za-z0-9_.:/-]+)\1/) ||
    lineText.match(/,\s*(['"])([^'"]+)\1\s*\)/);
  if (fallbackMatch?.[2]) return fallbackMatch[2];
  if (/PORT/i.test(name)) return '8080';
  if (/URL|URI|ENDPOINT|HOST/i.test(name)) return 'https://api.example.com';
  if (/LEVEL/i.test(name)) return 'info';
  if (/DEBUG|VERBOSE|ENABLE/i.test(name)) return 'true';
  if (/REGION/i.test(name)) return 'us-east-1';
  if (/SECRET|KEY|TOKEN|PASSWORD/i.test(name)) return `<your-${name.toLowerCase().replace(/_/g, '-')}>`;
  return `<${name.toLowerCase()}>`;
}

// Environment variables read by code but never mentioned in the README
function detectUndocumentedEnvVars(readmeContent: string, readmeFile: string, codeFiles: CodeFile[]): DriftItem[] {
  const envSources = new Map<string, { file: string; line: number | null; snippet: string; lineText: string }>();
  for (const { file, content } of codeFiles) {
    if (TEST_PATH.test(file)) continue;
    const isEnvExample = /(^|\/)\.env\.(example|sample|template)$/i.test(file);
    const patterns = isEnvExample ? [/^([A-Z_][A-Z0-9_]*)=/gm] : ENV_PATTERNS;
    const lines = content.split('\n');
    for (const pattern of patterns) {
      for (const match of Array.from(content.matchAll(pattern))) {
        const name = match[1];
        if (envSources.has(name) || IGNORED_ENV_VARS.has(name)) continue;
        if (CI_ENV_PREFIXES.some((prefix) => name.startsWith(prefix))) continue;
        const lineNo = findLineNumber(content, match[0]);
        const lineText = lineNo ? (lines[lineNo - 1] || match[0]).trim() : match[0];
        envSources.set(name, { file, line: lineNo, snippet: lineText, lineText });
      }
    }
  }

  const drifts: DriftItem[] = [];
  for (const [name, source] of Array.from(envSources)) {
    if (new RegExp(`\\b${escapeRegExp(name)}\\b`).test(readmeContent)) continue;
    if (drifts.length >= MAX_ITEMS_PER_KIND) break;
    const exampleVal = inferEnvExampleValue(name, source.lineText);
    const docEntry = `- \`${name}=${exampleVal}\` (read in \`${source.file}${source.line ? `:${source.line}` : ''}\`)`;
    drifts.push(
      makeDrift({
        id: `env-${name}`,
        title: `Environment variable \`${name}\` is missing from the README`,
        category: 'ENV_VARIABLE',
        severity: 'MEDIUM',
        docFile: readmeFile,
        docLineRange: 'Environment Variables',
        codeFile: source.file,
        codeLineRange: source.line ? `L${source.line}` : '',
        docSnippet: '// Not documented in README',
        codeSnippet: source.snippet,
        explanation: `Code at \`${source.file}${source.line ? `:${source.line}` : ''}\` reads \`${name}\`, but the README never documents what value to set (recommended example: \`export ${name}="${exampleVal}"\`).`,
        newcomerImpact: `Contributors won't know to set \`${name}=${exampleVal}\`; the app may fail on first boot or silently fall back to a default.`,
        suggestedDocFix: `export ${name}="${exampleVal}"`,
        fixes: [{ type: 'appendToSection', heading: 'Environment Variables', line: docEntry }],
      })
    );
  }
  return drifts;
}

// Flags named in an issue title, e.g. "Flag `--port` was renamed" -> ["--port"]
const flagsIn = (text: string) => Array.from(text.matchAll(/--[a-zA-Z0-9][\w-]*/g)).map((m) => m[0]);

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

function summarize(drifts: DriftItem[], hasDoc: boolean, docLabel = 'README'): string {
  if (!hasDoc) return `No ${docLabel} found, so there is no documentation to check.`;
  if (drifts.length === 0) return `The ${docLabel} matches the code. No issues found.`;
  const critical = drifts.filter((d) => d.severity === 'CRITICAL').length;
  return `Found ${drifts.length} issue${drifts.length === 1 ? '' : 's'} in ${docLabel}${critical ? ` (${critical} critical)` : ''}.`;
}

export async function analyzeLocalDirectory(
  repoPath: string,
  repoName: string,
  repoUrl: string | undefined,
  settings: Settings,
  docTarget: DocTarget = 'readme'
): Promise<RepoAnalysisResult> {
  const docsScanned: string[] = [];
  const codeFilesScanned: string[] = [];

  // 1. Gather all files (Dirent.isFile/isDirectory are false for symlinks, so links are never followed)
  function scanDir(dir: string, depth = 0) {
    if (depth > settings.maxScanDepth) return;
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

  const codeFiles: CodeFile[] = [];
  for (const cFile of codeFilesScanned.slice(0, settings.maxCodeFiles)) {
    try {
      const fullPath = path.join(repoPath, cFile);
      if (fs.statSync(fullPath).size > settings.maxFileSizeKb * 1024) continue;
      codeFiles.push({ file: cFile, content: fs.readFileSync(fullPath, 'utf-8') });
    } catch (e) {
      // skip unreadable files
    }
  }

  // Prefer the root README over nested ones (docs/README.md, examples/*/README.md, ...)
  let rootReadmeContent = '';
  const readmes = docsScanned.filter((d) => path.basename(d).toLowerCase().startsWith('readme'));
  const rootReadmeFile = readmes.find((d) => !d.includes('/')) || readmes[0] || docsScanned[0] || 'README.md';
  if (docsScanned.length > 0) {
    try {
      rootReadmeContent = fs.readFileSync(path.join(repoPath, rootReadmeFile), 'utf-8');
    } catch (e) {
      console.warn('Failed to read readme file:', e);
    }
  }

  let readmeFile = rootReadmeFile;
  let readmeContent = rootReadmeContent;

  if (docTarget === 'api') {
    const apiDocCandidates = docsScanned.filter(
      (d) =>
        /(^|\/)(api|rest|reference|endpoints|openapi|swagger|sdk)[^/]*\.md$/i.test(d) ||
        (/^docs\/.+\.md$/i.test(d) && !/readme|contributing|changelog/i.test(d))
    );
    const chosenApiDoc = apiDocCandidates[0];
    if (chosenApiDoc) {
      readmeFile = chosenApiDoc;
      try {
        readmeContent = fs.readFileSync(path.join(repoPath, chosenApiDoc), 'utf-8');
      } catch {
        readmeContent = '';
      }
    } else {
      const synthesized = synthesizeApiDocForRepo(repoName, rootReadmeContent, codeFiles);
      readmeFile = synthesized.file;
      readmeContent = synthesized.content;
      if (!docsScanned.includes(readmeFile)) {
        docsScanned.push(readmeFile);
      }
    }
  }

  // Deterministic checks run on every scan, whichever engine finds the code drift.
  // Link checking is network-bound, so it runs while the model is thinking.
  const linkCheck =
    readmeContent && settings.checkLinks
      ? checkLinks(readmeContent, readmeFile, repoPath, {
          maxLinks: settings.maxLinksToCheck,
          timeoutMs: settings.linkTimeoutSec * 1000,
        })
      : Promise.resolve([] as DriftItem[]);
  const cliDrifts = readmeContent && settings.checkCliFlags ? auditCliFlags(readmeContent, readmeFile, codeFiles) : [];
  const apiDrifts =
    readmeContent && docTarget === 'api' ? auditApiDocs(readmeContent, readmeFile, codeFiles) : [];
  const otherChecks = readmeContent
    ? [
        ...(settings.checkSecrets ? findSecrets(readmeContent, readmeFile) : []),
        ...(settings.checkLicense ? checkLicense(readmeContent, readmeFile, repoPath) : []),
      ]
    : [];

  let foundDrifts: DriftItem[] | null = null;
  let modelUsed = 'Rule-based checks';
  let inferenceMode: RepoAnalysisResult['inferenceMode'] = 'GEMMA_LOCAL_SIMULATOR';
  let modelError: string | null = null;

  const docLabel = docTarget === 'api' ? `API Docs (${readmeFile})` : 'the README';

  if (!readmeContent) {
    foundDrifts = [];
    modelUsed = `Not run (no ${docTarget === 'api' ? 'API docs' : 'README'})`;
  } else if (settings.analysisMode !== 'rules') {
    const lmStatus = await checkLMStudioHealth(settings.lmStudioEndpoint, settings.model);
    if (!lmStatus.connected) {
      modelError = lmStatus.error || 'LM Studio is not reachable';
    } else {
      const promptFiles = [...codeFiles]
        .sort((a, b) => codeFilePriority(b.file, b.content) - codeFilePriority(a.file, a.content))
        .slice(0, settings.filesForAnalysis);

      const prompt = `Analyze this repository's ${docTarget === 'api' ? 'API documentation' : 'README documentation'} and code to identify Documentation Drift (outdated flags, changed API routes, renamed SDK methods, missing env vars, broken quickstart steps).

Documentation (${readmeFile}):
${readmeContent.slice(0, settings.readmeCharsForAnalysis)}

Codebase Snippets:
${promptFiles.map((c) => `--- File: ${c.file} ---\n${c.content.slice(0, settings.charsPerFile)}`).join('\n\n')}

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
    "docSnippet": "exact outdated code, endpoint, or command from documentation",
    "codeSnippet": "actual current code signature, route handler, or definition",
    "explanation": "why this is drifted and what changed in code",
    "newcomerImpact": "how a new contributor or API consumer will fail if they follow the docs",
    "suggestedDocFix": "the exact corrected instruction (for ENV_VARIABLE drifts: NAME=<value> lines)"
  }
]
`;

      try {
        const gemmaResponse = await queryGemmaLMStudio({
          endpoint: settings.lmStudioEndpoint,
          model: lmStatus.model,
          messages: [
            { role: 'system', content: settings.analysisPrompt },
            { role: 'user', content: prompt },
          ],
          temperature: settings.temperature,
          maxTokens: settings.analysisMaxTokens,
          timeoutMs: settings.requestTimeoutSec * 1000,
        });

        const parsed = parseDriftJson(gemmaResponse.content);
        if (parsed) {
          foundDrifts = normalizeDrifts(parsed, readmeFile);
          inferenceMode = 'LM_STUDIO_LIVE';
          modelUsed = `${gemmaResponse.model} (LM Studio)`;
        } else {
          modelError = 'the model did not return a JSON array';
        }
      } catch (err: any) {
        modelError = err.message || 'the model request failed';
      }
    }
  }

  let notice: string | undefined;
  if (!foundDrifts) {
    if (settings.analysisMode === 'model') {
      throw new Error(`Model analysis failed: ${modelError?.replace(/\.$/, '')}. Set the analysis engine to Auto in Settings to fall back to rule-based checks.`);
    }
    foundDrifts = detectUndocumentedEnvVars(readmeContent, readmeFile, codeFiles);
    if (modelError) {
      modelUsed = 'Rule-based fallback';
      notice = `Model unavailable (${modelError}), so only rule-based checks ran.`;
    }
  }

  // Skip CLI findings the model already reported for the same flag
  const modelFlags = new Set(foundDrifts.flatMap((d) => flagsIn(`${d.title} ${d.docSnippet}`)));
  const newCli = cliDrifts.filter((d) => !flagsIn(d.title).some((f) => modelFlags.has(f)));

  const seenIds = new Set<string>();
  foundDrifts = [...apiDrifts, ...foundDrifts, ...newCli, ...otherChecks, ...(await linkCheck)].map((d) => {
    let id = d.id;
    while (seenIds.has(id)) id = `${d.id}-${seenIds.size}`;
    seenIds.add(id);
    return id === d.id ? d : { ...d, id };
  });

  return {
    repoName,
    repoUrl,
    isSample: false,
    docTarget,
    totalFilesScanned: docsScanned.length + codeFilesScanned.length,
    docsScanned,
    codeFilesScanned,
    metrics: calculateMetrics(foundDrifts),
    drifts: foundDrifts,
    modelUsed,
    inferenceMode,
    analyzedAt: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    summary: summarize(foundDrifts, !!readmeContent, docLabel),
    notice,
    readmeFile: readmeContent ? readmeFile : undefined,
    readmeContent: readmeContent || undefined,
  };
}

// Examples are precomputed, so they load instantly and need no model, while respecting feature toggles.
export function analyzeSampleRepo(
  sampleId: string,
  settings?: Settings,
  docTarget: DocTarget = 'readme'
): RepoAnalysisResult {
  const sample = SAMPLE_REPOS[sampleId];
  const isApi = docTarget === 'api';
  const rawDrifts = isApi ? sample.expectedApiDrifts : sample.expectedDrifts;
  const filteredDrifts = rawDrifts.filter((d) => {
    if (!settings) return true;
    if (d.category === 'CLI_FLAG' && !settings.checkCliFlags) return false;
    if (d.category === 'DEAD_LINK' && !settings.checkLinks) return false;
    if (d.category === 'SECRET_LEAK' && !settings.checkSecrets) return false;
    if (d.category === 'LICENSE_MISMATCH' && !settings.checkLicense) return false;
    return true;
  });

  const targetFile = isApi ? sample.apiDocFile || 'docs/api.md' : 'README.md';
  const targetContent = isApi ? sample.apiDocContent : sample.readmeContent;
  const docLabel = isApi ? `API Docs (${targetFile})` : 'the README';

  return {
    repoName: sample.name,
    isSample: true,
    sampleId: sample.id,
    docTarget,
    totalFilesScanned: 2 + Object.keys(sample.codeFiles).length,
    docsScanned: ['README.md', sample.apiDocFile || 'docs/api.md'],
    codeFilesScanned: Object.keys(sample.codeFiles),
    metrics: calculateMetrics(filteredDrifts),
    drifts: filteredDrifts,
    modelUsed: 'Built-in example',
    inferenceMode: 'GEMMA_LOCAL_SIMULATOR',
    analyzedAt: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    summary: summarize(filteredDrifts, true, docLabel),
    readmeFile: targetFile,
    readmeContent: targetContent,
  };
}

// Materializes a sample repo to a temporary directory and runs the full live Gemma 4 + rule-check pipeline.
export async function analyzeSampleRepoLive(
  sampleId: string,
  settings: Settings,
  docTarget: DocTarget = 'readme'
): Promise<RepoAnalysisResult> {
  const os = await import('os');
  const sample = SAMPLE_REPOS[sampleId];
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docdrift-sample-'));
  try {
    fs.writeFileSync(path.join(tempDir, 'README.md'), sample.readmeContent, 'utf-8');
    if (sample.apiDocContent) {
      const apiTarget = path.join(tempDir, sample.apiDocFile || 'docs/api.md');
      fs.mkdirSync(path.dirname(apiTarget), { recursive: true });
      fs.writeFileSync(apiTarget, sample.apiDocContent, 'utf-8');
    }
    for (const [relPath, fileContent] of Object.entries(sample.codeFiles)) {
      const target = path.join(tempDir, relPath);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, fileContent, 'utf-8');
    }
    const res = await analyzeLocalDirectory(
      tempDir,
      sample.name,
      `https://github.com/${sample.name}`,
      settings,
      docTarget
    );
    return {
      ...res,
      isSample: false,
      sampleId: sample.id,
    };
  } finally {
    fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

