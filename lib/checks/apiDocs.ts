import { DriftItem } from '../types';
import { CodeFile, MAX_ITEMS_PER_KIND, TEST_PATH, findLineNumber, makeDrift } from './common';

export interface DiscoveredRoute {
  method: string;
  path: string;
  file: string;
  line: number;
  snippet: string;
}

export interface DiscoveredFunction {
  name: string;
  params: string;
  file: string;
  line: number;
  snippet: string;
}

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * Extracts HTTP route handlers from Express, Fastify, Next.js, Flask, and FastAPI code files.
 */
export function extractCodeRoutes(codeFiles: CodeFile[]): DiscoveredRoute[] {
  const routes: DiscoveredRoute[] = [];
  const seen = new Set<string>();

  const patterns = [
    // Express / Fastify / Hono: app.get('/v1/users', ...) or router.post("/v2/token", ...)
    /\b(?:app|router|server|api)\.(get|post|put|patch|delete)\(\s*['"`](\/[^'"`\s)]*)['"`]/gi,
    // FastAPI / Flask decorators: @app.post("/v2/oauth/token") or @router.get('/v2/sessions')
    /@(?:app|router|bp|api)\.(get|post|put|patch|delete)\(\s*['"`](\/[^'"`\s)]*)['"`]/gi,
    // Flask @app.route('/v2/verify', methods=['POST'])
    /@(?:app|bp|api)\.route\(\s*['"`](\/[^'"`\s)]*)['"`](?:[^)]*methods\s*=\s*\[\s*['"`](GET|POST|PUT|PATCH|DELETE)['"`])?/gi,
  ];

  for (const { file, content } of codeFiles) {
    if (TEST_PATH.test(file)) continue;
    const lines = content.split('\n');

    for (let pIdx = 0; pIdx < patterns.length; pIdx++) {
      const regex = patterns[pIdx];
      for (const match of Array.from(content.matchAll(regex))) {
        let method = 'GET';
        let routePath = '';
        if (pIdx === 2) {
          routePath = match[1];
          method = (match[2] || 'GET').toUpperCase();
        } else {
          method = match[1].toUpperCase();
          routePath = match[2];
        }
        const key = `${method} ${routePath}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const line = findLineNumber(content, match[0]) || 1;
        const snippet = (lines[line - 1] || match[0]).trim();
        routes.push({ method, path: routePath, file, line, snippet });
      }
    }
  }
  return routes;
}

/**
 * Extracts exported JS/TS functions and Python def signatures from code files.
 */
export function extractCodeFunctions(codeFiles: CodeFile[]): DiscoveredFunction[] {
  const fns: DiscoveredFunction[] = [];
  const seen = new Set<string>();

  const jsPattern = /export\s+(?:async\s+)?function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)/g;
  const pyPattern = /^def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)/gm;

  for (const { file, content } of codeFiles) {
    if (TEST_PATH.test(file)) continue;
    const lines = content.split('\n');
    for (const pattern of [jsPattern, pyPattern]) {
      for (const match of Array.from(content.matchAll(pattern))) {
        const name = match[1];
        if (name.startsWith('_') || seen.has(name)) continue;
        seen.add(name);
        const params = match[2].replace(/\s+/g, ' ').trim();
        const line = findLineNumber(content, match[0]) || 1;
        const snippet = (lines[line - 1] || match[0]).trim();
        fns.push({ name, params, file, line, snippet });
      }
    }
  }
  return fns;
}

/**
 * Audits an API documentation markdown file against discovered HTTP routes and SDK functions in code.
 */
export function auditApiDocs(
  apiDocContent: string,
  apiDocFile: string,
  codeFiles: CodeFile[]
): DriftItem[] {
  const drifts: DriftItem[] = [];
  const codeRoutes = extractCodeRoutes(codeFiles);
  const codeFns = extractCodeFunctions(codeFiles);
  const docLines = apiDocContent.split('\n');

  // 1. Check documented HTTP endpoints (e.g. `POST /v1/token` or `GET /api/v1/deployments`) against codeRoutes
  if (codeRoutes.length > 0) {
    const docRouteRegex = /\b(GET|POST|PUT|PATCH|DELETE)\s+(\/[A-Za-z0-9_./:{}-]+)/g;
    const seenDocRoutes = new Set<string>();

    for (const match of Array.from(apiDocContent.matchAll(docRouteRegex))) {
      const method = match[1].toUpperCase();
      const docPath = match[2].replace(/[.,;)`]+$/, '');
      const key = `${method} ${docPath}`;
      if (seenDocRoutes.has(key)) continue;
      seenDocRoutes.add(key);

      const exactMatch = codeRoutes.find((r) => r.method === method && r.path === docPath);
      if (exactMatch) continue;

      // Find closest route in code (same method or matching tail segment)
      const tail = docPath.split('/').filter(Boolean).pop();
      const candidate =
        codeRoutes.find((r) => r.method === method && tail && r.path.endsWith(`/${tail}`)) ||
        codeRoutes.find((r) => tail && r.path.endsWith(`/${tail}`)) ||
        codeRoutes.find((r) => r.method === method);

      if (candidate && drifts.length < MAX_ITEMS_PER_KIND) {
        const docLine = findLineNumber(apiDocContent, match[0]) || 1;
        const docLineText = (docLines[docLine - 1] || match[0]).trim();
        const updatedLineText = docLineText.replace(`${method} ${docPath}`, `${candidate.method} ${candidate.path}`);

        drifts.push(
          makeDrift({
            id: `api-route-${drifts.length + 1}`,
            title: `Endpoint \`${method} ${docPath}\` changed to \`${candidate.method} ${candidate.path}\` in \`${candidate.file}\``,
            category: 'API_ENDPOINT',
            severity: 'CRITICAL',
            docFile: apiDocFile,
            docLineRange: `L${docLine}`,
            codeFile: candidate.file,
            codeLineRange: `L${candidate.line}`,
            docSnippet: docLineText,
            codeSnippet: candidate.snippet,
            explanation: `API documentation references \`${method} ${docPath}\`, but \`${candidate.file}:${candidate.line}\` registers \`${candidate.method} ${candidate.path}\`. Requests to the documented route return HTTP 404.`,
            newcomerImpact: `API clients following \`${apiDocFile}\` hit 404 Not Found when calling \`${method} ${docPath}\`.`,
            suggestedDocFix: updatedLineText,
            fixes: [{ type: 'replace', find: `${method} ${docPath}`, replace: `${candidate.method} ${candidate.path}` }],
          })
        );
      }
    }

    // Check for undocumented routes present in code but missing from API docs
    for (const route of codeRoutes) {
      if (drifts.length >= MAX_ITEMS_PER_KIND) break;
      if (!apiDocContent.includes(route.path)) {
        drifts.push(
          makeDrift({
            id: `api-missing-route-${drifts.length + 1}`,
            title: `New endpoint \`${route.method} ${route.path}\` in \`${route.file}\` is missing from API docs`,
            category: 'API_ENDPOINT',
            severity: 'HIGH',
            docFile: apiDocFile,
            docLineRange: 'Endpoints',
            codeFile: route.file,
            codeLineRange: `L${route.line}`,
            docSnippet: `// ${route.method} ${route.path} is not documented in ${apiDocFile}`,
            codeSnippet: route.snippet,
            explanation: `Route \`${route.method} ${route.path}\` is defined at \`${route.file}:${route.line}\` but is missing from \`${apiDocFile}\`.`,
            newcomerImpact: `Consumers integrating via \`${apiDocFile}\` cannot discover \`${route.method} ${route.path}\`.`,
            suggestedDocFix: `- \`${route.method} ${route.path}\` — registered in \`${route.file}:${route.line}\``,
            fixes: [
              {
                type: 'appendToSection',
                heading: 'Endpoints',
                line: `- \`${route.method} ${route.path}\` — registered in \`${route.file}:${route.line}\``,
              },
            ],
          })
        );
      }
    }
  }

  // 2. Check documented SDK function signatures against codeFns
  for (const fn of codeFns) {
    if (drifts.length >= MAX_ITEMS_PER_KIND) break;
    const callRegex = new RegExp(`\\b${fn.name}\\s*\\(([^)]*)\\)`, 'g');
    for (const match of Array.from(apiDocContent.matchAll(callRegex))) {
      const docArgs = match[1].replace(/\s+/g, ' ').trim();
      // Normalize parameter names by stripping types/defaults
      const codeParamNames = fn.params
        .split(',')
        .map((p) => p.split(/[:=]/)[0].trim())
        .filter((p) => p && p !== 'self' && p !== 'cls');
      const docParamNames = docArgs
        .split(',')
        .map((p) => p.split(/[:=]/)[0].trim())
        .filter(Boolean);

      if (
        docParamNames.length > 0 &&
        codeParamNames.length > 0 &&
        docParamNames.join(', ') !== codeParamNames.join(', ') &&
        !docArgs.includes('"') &&
        !docArgs.includes("'")
      ) {
        const docLine = findLineNumber(apiDocContent, match[0]) || 1;
        drifts.push(
          makeDrift({
            id: `api-fn-${fn.name}`,
            title: `SDK signature \`${fn.name}(${docArgs})\` drifted from \`${fn.file}:${fn.line}\``,
            category: 'FUNCTION_SIGNATURE',
            severity: 'HIGH',
            docFile: apiDocFile,
            docLineRange: `L${docLine}`,
            codeFile: fn.file,
            codeLineRange: `L${fn.line}`,
            docSnippet: match[0],
            codeSnippet: fn.snippet,
            explanation: `\`${apiDocFile}\` documents \`${fn.name}(${docArgs})\`, whereas \`${fn.file}:${fn.line}\` defines \`${fn.name}(${fn.params})\`.`,
            newcomerImpact: `Callers passing the old parameter list encounter TypeError or unexpected argument errors.`,
            suggestedDocFix: `${fn.name}(${fn.params})`,
            fixes: [{ type: 'replace', find: match[0], replace: `${fn.name}(${fn.params})` }],
          })
        );
        break;
      }
    }
  }

  return drifts;
}

/**
 * When a repository has no dedicated `docs/api.md` file on disk, synthesizes an API & SDK Reference
 * document from README API sections and discovered code signatures so API Docs auditing works on any repo.
 */
export function synthesizeApiDocForRepo(
  repoName: string,
  readmeContent: string,
  codeFiles: CodeFile[]
): { file: string; content: string } {
  const routes = extractCodeRoutes(codeFiles);
  const fns = extractCodeFunctions(codeFiles);

  const lines: string[] = [
    `# ${repoName} — API & SDK Reference`,
    '',
    `Programmatic REST endpoints, SDK function signatures, and runtime configuration for \`${repoName}\`.`,
    '',
    '## Endpoints',
  ];

  if (routes.length > 0) {
    // Include routes so any drift or undocumented route check can inspect them
    for (const r of routes.slice(0, 6)) {
      lines.push(`- \`${r.method} ${r.path}\` — handled in \`${r.file}:${r.line}\``);
    }
  } else {
    lines.push('- See CLI & programmatic SDK methods below.');
  }

  lines.push('', '## SDK & Programmatic Methods');
  if (fns.length > 0) {
    for (const fn of fns.slice(0, 6)) {
      lines.push(`\`\`\`ts`);
      lines.push(`${fn.name}(${fn.params})`);
      lines.push(`\`\`\``);
    }
  } else if (readmeContent) {
    lines.push(readmeContent.slice(0, 1200));
  }

  lines.push('', '## Environment Variables', 'Configure runtime secrets and API credentials before starting the server.');

  return {
    file: 'docs/api.md',
    content: lines.join('\n') + '\n',
  };
}
