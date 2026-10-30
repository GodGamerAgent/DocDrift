import { diffLines } from 'diff';
import { DriftItem } from './types';

export interface DiffLine {
  id: number;
  text: string;
  oldNo?: number;
  newNo?: number;
}

export type DiffBlock =
  | { kind: 'context'; lines: DiffLine[] }
  | { kind: 'change'; id: number; removed: DiffLine[]; added: DiffLine[] };

const splitLines = (value: string) => {
  const lines = value.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  return lines;
};

// Groups the line diff into unchanged runs and change blocks (removed lines followed by added lines).
export function buildDiffBlocks(original: string, fixed: string): DiffBlock[] {
  const blocks: DiffBlock[] = [];
  let oldNo = 1;
  let newNo = 1;
  let nextId = 0;

  for (const part of diffLines(original, fixed)) {
    const lines = splitLines(part.value);
    if (!part.added && !part.removed) {
      blocks.push({ kind: 'context', lines: lines.map((text) => ({ id: nextId++, text, oldNo: oldNo++, newNo: newNo++ })) });
      continue;
    }
    let block = blocks[blocks.length - 1];
    if (!block || block.kind !== 'change') {
      block = { kind: 'change', id: nextId++, removed: [], added: [] };
      blocks.push(block);
    }
    for (const text of lines) {
      if (part.removed) block.removed.push({ id: nextId++, text, oldNo: oldNo++ });
      else block.added.push({ id: nextId++, text, newNo: newNo++ });
    }
  }
  return blocks;
}

export function changedLineIds(blocks: DiffBlock[]): number[] {
  return blocks.flatMap((b) => (b.kind === 'change' ? [...b.removed, ...b.added].map((l) => l.id) : []));
}

// Rebuilds the README from per-line decisions: a rejected removal keeps the original
// line, a rejected addition is left out.
export function composeReadme(blocks: DiffBlock[], accepted: Set<number>, endsWithNewline: boolean): string {
  const out: string[] = [];
  for (const block of blocks) {
    if (block.kind === 'context') {
      out.push(...block.lines.map((l) => l.text));
      continue;
    }
    for (const line of block.removed) if (!accepted.has(line.id)) out.push(line.text);
    for (const line of block.added) if (accepted.has(line.id)) out.push(line.text);
  }
  return out.join('\n') + (endsWithNewline ? '\n' : '');
}

// "file:line" for the code that triggered an issue, falling back to the README line.
export function sourceRef(drift: DriftItem): string {
  const lineOf = (range: string) => range.match(/L(\d+)/)?.[1];
  if (drift.codeFile) {
    const line = lineOf(drift.codeLineRange);
    return line ? `${drift.codeFile}:${line}` : drift.codeFile;
  }
  const line = lineOf(drift.docLineRange);
  return line ? `${drift.docFile}:${line}` : drift.docFile;
}

// Which issues explain a change block: matched through their structured fixes,
// the identifiers they name in `backticks`, or the README text they quote.
export function driftsForBlock(block: Extract<DiffBlock, { kind: 'change' }>, drifts: DriftItem[]): DriftItem[] {
  const removed = block.removed.map((l) => l.text);
  const added = block.added.map((l) => l.text);
  const changed = [...removed, ...added];
  const anyHas = (lines: string[], needle: string) => needle.length >= 3 && lines.some((l) => l.includes(needle));

  return drifts.filter((drift) => {
    for (const fix of drift.fixes ?? []) {
      if (fix.type === 'replace' && (anyHas(removed, fix.find) || anyHas(added, fix.replace.trim()))) return true;
      if (fix.type === 'appendToSection' && anyHas(added, fix.line.trim())) return true;
    }
    const named = Array.from(drift.title.matchAll(/`([^`]+)`/g)).map((m) => m[1]);
    if (named.some((n) => anyHas(changed, n))) return true;

    const quoted = drift.docSnippet.split('\n').map((l) => l.trim()).filter((l) => l.length >= 6 && !l.startsWith('//'));
    if (quoted.some((q) => removed.some((r) => r.includes(q) || (r.trim().length >= 6 && q.includes(r.trim()))))) return true;

    const suggested = drift.suggestedDocFix.split('\n')[0].trim();
    return suggested.length >= 6 && anyHas(added, suggested);
  });
}
