import { DocFix } from './types';

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function appendToSection(text: string, heading: string, line: string): string {
  const lines = text.split('\n');
  if (lines.some((l) => l.trim() === line.trim())) return text;

  const headingRe = new RegExp(`^(#{1,6})\\s+${escapeRegExp(heading)}\\s*$`, 'i');
  const start = lines.findIndex((l) => headingRe.test(l));
  if (start === -1) {
    return `${text.replace(/\s*$/, '')}\n\n## ${heading}\n\n${line}\n`;
  }

  // The section ends at the next heading of the same or a higher level
  const level = lines[start].match(/^#+/)![0].length;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6})\s/);
    if (m && m[1].length <= level) {
      end = i;
      break;
    }
  }
  // Insert after the section's last non-blank line
  let insertAt = end;
  while (insertAt > start + 1 && lines[insertAt - 1].trim() === '') insertAt--;
  const needsGap = insertAt === start + 1 || !/^\s*[-*]\s/.test(lines[insertAt - 1]);
  lines.splice(insertAt, 0, ...(needsGap ? ['', line] : [line]));
  return lines.join('\n');
}

export function applyFixes(text: string, fixes: DocFix[]): { text: string; applied: number } {
  let applied = 0;
  for (const fix of fixes) {
    const before = text;
    if (fix.type === 'replace') {
      text = fix.token
        ? text.replace(new RegExp(`(?<![\\w-])${escapeRegExp(fix.find)}(?![\\w-])`, 'g'), fix.replace)
        : text.split(fix.find).join(fix.replace);
    } else {
      text = appendToSection(text, fix.heading, fix.line);
    }
    if (text !== before) applied++;
  }
  return { text, applied };
}
