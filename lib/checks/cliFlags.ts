import { DriftItem } from '../types';
import {
  CodeFile,
  MAX_ITEMS_PER_KIND,
  SHELL_LANGS,
  TEST_PATH,
  THIRD_PARTY_COMMANDS,
  extractMarkdownCodeBlocks,
  makeDrift,
} from './common';

interface DefinedFlag {
  flag: string;
  command: string | null; // subcommand the option belongs to, null = global/unknown
  file: string;
  line: number;
  snippet: string;
  description: string;
  valueHint: string;
  required: boolean;
}

interface DocumentedFlag {
  flag: string;
  command: string | null;
  line: number;
  lineText: string;
}

const IGNORED_FLAGS = new Set(['help', 'version', 'verbose']);

const quoted = (text: string) => Array.from(text.matchAll(/(['"`])((?:(?!\1).)*)\1/g)).map((m) => m[2]);

// Option definitions per parser style. Each returns the long flags declared on one line.
function parseOptionLine(line: string): Omit<DefinedFlag, 'file' | 'line' | 'snippet' | 'command'>[] {
  // Commander: .option('-p, --port <n>', 'description') / .requiredOption(...)
  const commander = line.match(/\.(option|requiredOption)\(\s*(['"`])([^'"`]*--[^'"`]*)\2(?:\s*,\s*(['"`])((?:(?!\4).)*)\4)?/);
  if (commander) {
    const valueHint = commander[3].match(/[<[][^>\]]+[>\]]/)?.[0] ?? '';
    return Array.from(commander[3].matchAll(/--([a-zA-Z0-9][\w-]*)/g)).map((m) => ({
      flag: m[1],
      description: commander[5] ?? '',
      valueHint,
      required: commander[1] === 'requiredOption',
    }));
  }

  // argparse add_argument('--x', help='...', required=True) / click.option('--x', help='...')
  const pyCall = line.match(/(?:add_argument|click\.option)\((.*)\)?/);
  if (pyCall) {
    const args = pyCall[1];
    const help = args.match(/help\s*=\s*(['"])((?:(?!\1).)*)\1/)?.[2] ?? '';
    return quoted(args)
      .filter((s) => s.startsWith('--'))
      .map((s) => ({
        flag: s.slice(2),
        description: help,
        valueHint: '',
        required: /required\s*=\s*True/.test(args),
      }));
  }

  // Go flag package: flag.String("port", "8080", "description")
  const goFlag = line.match(/\bflag\.(?:String|Int|Int64|Uint|Bool|Duration|Float64)(?:Var)?\(\s*(?:&?[\w.]+\s*,\s*)?"([\w-]+)"\s*,\s*[^,]+,\s*"([^"]*)"/);
  if (goFlag) return [{ flag: goFlag[1], description: goFlag[2], valueHint: '', required: false }];

  // yargs: .option('port', { describe: '...' })
  const yargs = line.match(/\.option\(\s*['"]([a-zA-Z][\w-]*)['"]\s*,/);
  if (yargs) {
    const describe = line.match(/(?:describe|description|desc)\s*:\s*(['"])((?:(?!\1).)*)\1/)?.[2] ?? '';
    return [{ flag: yargs[1], description: describe, valueHint: '', required: /demandOption\s*:\s*true/.test(line) }];
  }

  return [];
}

function collectDefinedFlags(codeFiles: CodeFile[]): DefinedFlag[] {
  const defined: DefinedFlag[] = [];
  for (const { file, content } of codeFiles) {
    if (TEST_PATH.test(file)) continue;
    let command: string | null = null;
    // argparse subparsers: `push = sub.add_parser('push')` then `push.add_argument(...)`
    const parserVars = new Map<string, string>();
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const cmd = line.match(/\.command\(\s*['"`]([\w:-]+)/);
      if (cmd) command = cmd[1];
      const sub = line.match(/(\w+)\s*=\s*\w+\.add_parser\(\s*['"]([\w-]+)['"]/);
      if (sub) parserVars.set(sub[1], sub[2]);

      for (const option of parseOptionLine(line)) {
        if (IGNORED_FLAGS.has(option.flag)) continue;
        const owner = line.match(/(\w+)\.add_argument\(/)?.[1];
        defined.push({
          ...option,
          command: (owner && parserVars.get(owner)) || command,
          file,
          line: i + 1,
          snippet: line.trim(),
        });
      }
    }
  }
  return defined;
}

function collectDocumentedFlags(readme: string, readmeFile: string, knownCommands: Set<string>): DocumentedFlag[] {
  const documented: DocumentedFlag[] = [];
  const blocks = extractMarkdownCodeBlocks(readme, readmeFile).filter((b) => SHELL_LANGS.has(b.language.toLowerCase()));

  for (const block of blocks) {
    const lines = block.code.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim().replace(/^\$\s+/, '').replace(/^sudo\s+/, '');
      if (!line || line.startsWith('#')) continue;
      const tokens = line.split(/\s+/);
      if (THIRD_PARTY_COMMANDS.has(tokens[0])) continue;

      // `tool push --x` → the first bare word after the program that names a known subcommand
      const command = tokens.slice(1).find((t) => !t.startsWith('-') && knownCommands.has(t)) ?? null;
      for (const match of Array.from(line.matchAll(/(?:^|\s)--([a-zA-Z0-9][\w-]*)/g))) {
        if (IGNORED_FLAGS.has(match[1])) continue;
        documented.push({ flag: match[1], command, line: block.startLine + 1 + i, lineText: lines[i].trim() });
      }
    }
  }
  return documented;
}

// Similarity of two flag names: shared dash-separated words, or near-identical spelling (--colour/--color).
function similarity(a: string, b: string): number {
  const wa = a.split(/[-_]/);
  const wb = b.split(/[-_]/);
  const shared = wa.filter((w) => wb.includes(w)).length;
  const wordScore = shared / Math.max(wa.length, wb.length);

  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  const editScore = 1 - dp[a.length][b.length] / Math.max(a.length, b.length);

  return Math.max(wordScore, editScore >= 0.75 ? editScore : 0);
}

const sameCommand = (a: string | null, b: string | null) => a === null || b === null || a === b;
const loc = (d: DefinedFlag) => `L${d.line}`;
const usageLine = (d: DefinedFlag) =>
  `- \`--${d.flag}${d.valueHint ? ` ${d.valueHint}` : ''}\`${d.command ? ` (${d.command})` : ''}${d.description ? `: ${d.description}` : ''}`;

export function auditCliFlags(readme: string, readmeFile: string, codeFiles: CodeFile[]): DriftItem[] {
  const defined = collectDefinedFlags(codeFiles);
  if (defined.length === 0) return [];

  const knownCommands = new Set(defined.map((d) => d.command).filter((c): c is string => !!c));
  const documented = collectDocumentedFlags(readme, readmeFile, knownCommands);
  const mentionedAnywhere = new Set(Array.from(readme.matchAll(/--([a-zA-Z0-9][\w-]*)/g)).map((m) => m[1]));
  const isDefined = (doc: DocumentedFlag) => defined.some((d) => d.flag === doc.flag && sameCommand(d.command, doc.command));

  const drifts: DriftItem[] = [];
  const usedAsRename = new Set<DefinedFlag>();
  const seenRemoved = new Set<string>();

  // 1. Flags the README uses that the CLI no longer defines: renamed if a similar undocumented flag exists
  for (const doc of documented) {
    if (isDefined(doc) || seenRemoved.has(doc.flag)) continue;
    seenRemoved.add(doc.flag);

    const rename = defined
      .filter((d) => !mentionedAnywhere.has(d.flag) && !usedAsRename.has(d) && sameCommand(d.command, doc.command))
      .map((d) => ({ d, score: similarity(doc.flag, d.flag) }))
      .filter((c) => c.score >= 0.5)
      .sort((a, b) => b.score - a.score)[0]?.d;

    if (rename) {
      usedAsRename.add(rename);
      drifts.push(
        makeDrift({
          id: `cli-renamed-${doc.flag}`,
          title: `Flag \`--${doc.flag}\` was renamed to \`--${rename.flag}\``,
          category: 'CLI_FLAG',
          severity: 'HIGH',
          docFile: readmeFile,
          docLineRange: `L${doc.line}`,
          codeFile: rename.file,
          codeLineRange: loc(rename),
          docSnippet: doc.lineText,
          codeSnippet: rename.snippet,
          explanation: `The README uses \`--${doc.flag}\`, but the CLI now defines \`--${rename.flag}\` instead.`,
          newcomerImpact: `Running the documented command fails with an "unknown option" error.`,
          suggestedDocFix: doc.lineText.replace(new RegExp(`--${doc.flag}(?![\\w-])`, 'g'), `--${rename.flag}`),
          fixes: [{ type: 'replace', find: `--${doc.flag}`, replace: `--${rename.flag}`, token: true }],
        })
      );
    } else {
      drifts.push(
        makeDrift({
          id: `cli-removed-${doc.flag}`,
          title: `Documented flag \`--${doc.flag}\` no longer exists`,
          category: 'CLI_FLAG',
          severity: 'HIGH',
          docFile: readmeFile,
          docLineRange: `L${doc.line}`,
          codeFile: defined[0].file,
          codeSnippet: `// No --${doc.flag} option is defined${doc.command ? ` for "${doc.command}"` : ''}`,
          docSnippet: doc.lineText,
          explanation: `The README passes \`--${doc.flag}\`, but no CLI option with that name is defined in the code.`,
          newcomerImpact: `Running the documented command fails with an "unknown option" error.`,
          suggestedDocFix: `Remove \`--${doc.flag}\` from the command or replace it with the current option.`,
        })
      );
    }
  }

  // 2. Defined flags the README never mentions: required ones break the quickstart, others are just undocumented
  let added = 0;
  for (const d of defined) {
    if (mentionedAnywhere.has(d.flag) || usedAsRename.has(d)) continue;
    if (drifts.some((x) => x.id === `cli-added-${d.flag}`)) continue;
    if (!d.required && added >= MAX_ITEMS_PER_KIND) continue;
    if (!d.required) added++;

    drifts.push(
      makeDrift({
        id: `cli-added-${d.flag}`,
        title: d.required ? `Required flag \`--${d.flag}\` is missing from the docs` : `New flag \`--${d.flag}\` is not documented`,
        category: 'CLI_FLAG',
        severity: d.required ? 'HIGH' : 'LOW',
        docFile: readmeFile,
        docLineRange: 'Usage',
        codeFile: d.file,
        codeLineRange: loc(d),
        docSnippet: '// Not documented in README',
        codeSnippet: d.snippet,
        explanation: d.required
          ? `\`--${d.flag}\` is required${d.command ? ` by \`${d.command}\`` : ''}, but the README never mentions it.`
          : `The CLI defines \`--${d.flag}\`${d.command ? ` for \`${d.command}\`` : ''}, but the README doesn't document it.`,
        newcomerImpact: d.required
          ? `The documented command fails because a required option is missing.`
          : `Users won't discover this option from the docs.`,
        suggestedDocFix: usageLine(d),
        fixes: [{ type: 'appendToSection', heading: 'Usage', line: usageLine(d) }],
      })
    );
  }

  return drifts;
}
