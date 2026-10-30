import fs from 'fs';
import path from 'path';
import dns from 'dns';
import net from 'net';
import { DriftItem } from '../types';
import { makeDrift } from './common';

interface LinkRef {
  url: string;
  line: number;
  isImage: boolean;
}

interface UrlResult {
  dead: boolean;
  reason: string;
}

const BADGE_HOSTS = /(^|\.)(shields\.io|badgen\.net|travis-ci\.(org|com)|circleci\.com|codecov\.io|coveralls\.io|badge\.fury\.io|appveyor\.com)$/i;
const BADGE_FAILURE = /\b(failing|failed|failure|error|errored|invalid|not found|inaccessible|unknown|no status|cancelled)\b/i;
const DISCORD_INVITE = /^https?:\/\/(?:www\.)?(?:discord\.gg|discord(?:app)?\.com\/invite)\/([\w-]+)/i;
const MAX_REDIRECTS = 4;

// Blank out fenced and inline code (keeping line breaks) so example URLs like
// http://localhost:3000 inside code are not treated as links.
function stripCode(markdown: string): string {
  const blank = (s: string) => s.replace(/[^\n]/g, ' ');
  return markdown.replace(/```[\s\S]*?```/g, blank).replace(/`[^`\n]*`/g, blank);
}

export function extractLinks(markdown: string): LinkRef[] {
  const text = stripCode(markdown);
  const lineAt = (index: number) => text.slice(0, index).split('\n').length;
  const refs: LinkRef[] = [];
  const seen = new Set<string>();
  const add = (url: string, index: number, isImage: boolean) => {
    const clean = url.trim().replace(/^<|>$/g, '');
    if (!clean || /^(#|mailto:|tel:|data:|javascript:)/i.test(clean)) return;
    const key = `${clean}|${isImage}`;
    if (seen.has(key)) return;
    seen.add(key);
    refs.push({ url: clean, line: lineAt(index), isImage });
  };

  const target = String.raw`\(\s*(<[^>]+>|[^)\s]+)(?:\s+["'][^"']*["'])?\s*\)`;
  // Images first, then links, whose text may itself be an image: [![badge](img)](link)
  for (const m of Array.from(text.matchAll(new RegExp(String.raw`!\[[^\]]*\]` + target, 'g')))) add(m[1], m.index ?? 0, true);
  for (const m of Array.from(
    text.matchAll(new RegExp(String.raw`(?<!!)\[(?:[^\[\]]|!\[[^\]]*\]\([^)]*\))*\]` + target, 'g'))
  ))
    add(m[1], m.index ?? 0, false);
  for (const m of Array.from(text.matchAll(/^\s*\[[^\]]+\]:\s*(\S+)/gm))) add(m[1], m.index ?? 0, false);
  for (const m of Array.from(text.matchAll(/<(a|img|source)\b[^>]*?\b(?:href|src|srcset)\s*=\s*["']([^"'\s]+)/gi)))
    add(m[2], m.index ?? 0, m[1].toLowerCase() !== 'a');
  for (const m of Array.from(text.matchAll(/(?<![("'<\[=])\bhttps?:\/\/[^\s<>()"'`\]]+/g)))
    if (!refs.some((r) => r.url === m[0])) add(m[0].replace(/[.,;:!?]+$/, ''), m.index ?? 0, false);

  return refs;
}

function isPrivateAddress(address: string): boolean {
  if (net.isIPv4(address)) {
    const [a, b] = address.split('.').map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }
  const lower = address.toLowerCase();
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateAddress(mapped[1]);
  return lower === '::' || lower === '::1' || /^f[cd]/.test(lower) || /^fe[89ab]/.test(lower);
}

// README links come from whoever wrote the README, so never let them reach this
// machine or the local network (DNS answers are checked, and so is every redirect).
async function assertPublicUrl(url: URL): Promise<void> {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('unsupported protocol');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) throw new Error('private host');
  const addresses = net.isIP(host) ? [host] : (await dns.promises.lookup(host, { all: true })).map((a) => a.address);
  if (addresses.some(isPrivateAddress)) throw new Error('private host');
}

async function fetchPublic(rawUrl: string, method: 'HEAD' | 'GET', timeoutMs: number): Promise<Response> {
  let url = new URL(rawUrl);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicUrl(url);
    const res = await fetch(url, {
      method,
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'User-Agent': 'DocDrift link checker', Accept: '*/*' },
      cache: 'no-store',
    });
    const location = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && location) {
      url = new URL(location, url);
      continue;
    }
    return res;
  }
  throw new Error('too many redirects');
}

// Only report links we are sure are broken: 404/410 or a host that doesn't resolve.
// Timeouts, 403s and rate limits are common for bots, so they are not reported.
async function checkExternal(link: LinkRef, timeoutMs: number): Promise<UrlResult> {
  try {
    const discord = link.url.match(DISCORD_INVITE);
    if (discord) {
      const res = await fetchPublic(`https://discord.com/api/v10/invites/${discord[1]}`, 'GET', timeoutMs);
      return res.status === 404 ? { dead: true, reason: 'Discord invite has expired or is invalid' } : { dead: false, reason: '' };
    }

    const host = new URL(link.url).hostname;
    const isBadge =
      link.isImage && (BADGE_HOSTS.test(host) || /\/badge\.svg|\/workflows\/.+\/badge/.test(link.url));

    let res = await fetchPublic(link.url, isBadge ? 'GET' : 'HEAD', timeoutMs);
    if (!isBadge && [400, 403, 405, 501].includes(res.status)) res = await fetchPublic(link.url, 'GET', timeoutMs);

    if (res.status === 404 || res.status === 410) return { dead: true, reason: `HTTP ${res.status}` };
    if (isBadge && res.ok) {
      const svg = (await res.text()).slice(0, 20000);
      const label = Array.from(svg.matchAll(/>([^<>]+)</g)).map((m) => m[1].trim()).filter(Boolean).join(' ');
      if (BADGE_FAILURE.test(label)) return { dead: true, reason: `badge reports "${label.slice(0, 80)}"` };
    }
    return { dead: false, reason: '' };
  } catch (err: any) {
    const code = err?.cause?.code || err?.code;
    if (code === 'ENOTFOUND') return { dead: true, reason: 'domain does not resolve' };
    return { dead: false, reason: '' };
  }
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i]);
      }
    })
  );
  return results;
}

export async function checkLinks(
  readme: string,
  readmeFile: string,
  repoPath: string,
  options: { maxLinks: number; timeoutMs: number }
): Promise<DriftItem[]> {
  const links = extractLinks(readme);
  const drifts: DriftItem[] = [];
  const readmeDir = path.dirname(path.join(repoPath, readmeFile));
  const repoRoot = path.resolve(repoPath);

  const report = (link: LinkRef, reason: string, i: number) => {
    const failingBadge = reason.startsWith('badge');
    const kind = DISCORD_INVITE.test(link.url) ? 'Discord invite' : failingBadge ? 'badge' : link.isImage ? 'image' : 'link';
    drifts.push(
      makeDrift({
        id: `link-${i}`,
        title: `${failingBadge ? 'Failing' : 'Broken'} ${kind}: ${link.url.length > 70 ? `${link.url.slice(0, 67)}…` : link.url}`,
        category: 'DEAD_LINK',
        severity: link.isImage && !reason.startsWith('badge') ? 'LOW' : 'MEDIUM',
        docFile: readmeFile,
        docLineRange: `L${link.line}`,
        docSnippet: link.url,
        codeSnippet: reason,
        explanation: `This ${kind} in the README is broken (${reason}).`,
        newcomerImpact: link.isImage ? 'Readers see a broken image or misleading status badge.' : 'Readers following the link hit a dead end.',
        suggestedDocFix: 'Update the URL or remove it.',
      })
    );
  };

  // Relative links point into the repository itself, so they are checked on disk
  const external: LinkRef[] = [];
  links.forEach((link, i) => {
    if (/^https?:\/\//i.test(link.url)) {
      external.push(link);
      return;
    }
    if (/^[a-z][a-z0-9+.-]*:/i.test(link.url)) return;
    let target = link.url.split(/[?#]/)[0];
    try {
      target = decodeURIComponent(target);
    } catch {
      // keep the raw path
    }
    if (!target) return;
    const resolved = path.resolve(target.startsWith('/') ? repoRoot : readmeDir, target.replace(/^\//, ''));
    if (!resolved.startsWith(repoRoot)) return;
    if (!fs.existsSync(resolved)) report(link, 'file not found in the repository', i);
  });

  const toCheck = external.slice(0, options.maxLinks);
  const results = await mapLimit(toCheck, 6, (link) => checkExternal(link, options.timeoutMs));
  results.forEach((result, i) => {
    if (result.dead) report(toCheck[i], result.reason, links.indexOf(toCheck[i]));
  });

  return drifts.sort((a, b) => parseInt(a.docLineRange.slice(1)) - parseInt(b.docLineRange.slice(1)));
}
