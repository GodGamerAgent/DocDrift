import fs from 'fs';
import path from 'path';
import { DriftItem } from '../types';
import { makeDrift } from './common';

interface LicenseDef {
  id: string;
  name: string;
  // Recognises the full license text in a LICENSE file
  text: (body: string) => boolean;
  // Recognises a mention of the license in README prose
  mention: RegExp;
}

// Order matters: more specific licenses (AGPL, LGPL) are checked before GPL.
const LICENSES: LicenseDef[] = [
  { id: 'AGPL-3.0', name: 'AGPL-3.0', text: (b) => /GNU AFFERO GENERAL PUBLIC LICENSE/i.test(b), mention: /\bAGPL(?:[ -]?v?3(?:\.0)?)?\b|GNU Affero/i },
  { id: 'LGPL-3.0', name: 'LGPL-3.0', text: (b) => /GNU LESSER GENERAL PUBLIC LICENSE\s+Version 3/i.test(b), mention: /\bLGPL[ -]?v?3/i },
  { id: 'LGPL-2.1', name: 'LGPL-2.1', text: (b) => /GNU LESSER GENERAL PUBLIC LICENSE\s+Version 2\.1/i.test(b), mention: /\bLGPL[ -]?v?2/i },
  { id: 'GPL-3.0', name: 'GPL-3.0', text: (b) => /GNU GENERAL PUBLIC LICENSE\s+Version 3/i.test(b), mention: /(?<!L|A)\bGPL[ -]?v?3|GNU General Public License,? v(?:ersion)?\s*3/i },
  { id: 'GPL-2.0', name: 'GPL-2.0', text: (b) => /GNU GENERAL PUBLIC LICENSE\s+Version 2/i.test(b), mention: /(?<!L|A)\bGPL[ -]?v?2|GNU General Public License,? v(?:ersion)?\s*2/i },
  { id: 'Apache-2.0', name: 'Apache 2.0', text: (b) => /Apache License,?\s+Version 2\.0/i.test(b), mention: /\bApache(?:[ -]License)?(?:[ ,_-]*(?:v(?:ersion)?\s*)?2(?:\.0)?)?\b/i },
  { id: 'MPL-2.0', name: 'MPL-2.0', text: (b) => /Mozilla Public License,?\s+(?:Version|v\.?)\s*2\.0/i.test(b), mention: /\bMPL(?:[ -]?2(?:\.0)?)?\b|Mozilla Public License/i },
  { id: 'BSD-3-Clause', name: 'BSD-3-Clause', text: (b) => /Redistribution and use in source and binary forms/i.test(b) && /Neither the name/i.test(b), mention: /\bBSD[ -]?3|\b3-Clause BSD/i },
  { id: 'BSD-2-Clause', name: 'BSD-2-Clause', text: (b) => /Redistribution and use in source and binary forms/i.test(b), mention: /\bBSD[ -]?2|\b2-Clause BSD/i },
  { id: 'ISC', name: 'ISC', text: (b) => /Permission to use, copy, modify, and\/?or distribute this software for any purpose/i.test(b), mention: /\bISC\b/ },
  { id: 'MIT', name: 'MIT', text: (b) => /Permission is hereby granted, free of charge/i.test(b), mention: /\bMIT\b/ },
  { id: 'Unlicense', name: 'Unlicense', text: (b) => /free and unencumbered software released into the public domain/i.test(b), mention: /\bUnlicense\b/i },
  { id: 'CC0-1.0', name: 'CC0-1.0', text: (b) => /CC0 1\.0 Universal/i.test(b), mention: /\bCC0\b/i },
];

function detectLicenseFile(repoPath: string): { file: string; license: LicenseDef | null } | null {
  let entries: string[] = [];
  try {
    entries = fs.readdirSync(repoPath);
  } catch {
    return null;
  }
  const file = entries.find((e) => /^(licen[cs]e|copying)(\.(md|txt|rst))?$/i.test(e));
  if (!file) return null;
  try {
    const body = fs.readFileSync(path.join(repoPath, file), 'utf-8').slice(0, 50000);
    return { file, license: LICENSES.find((l) => l.text(body)) ?? null };
  } catch {
    return null;
  }
}

// README lines that state the project's license: the "License" section and license badges.
function licenseClaimLines(readme: string): { index: number; text: string; isBadge: boolean }[] {
  const lines = readme.split('\n');
  const claims: { index: number; text: string; isBadge: boolean }[] = [];
  let inSection = false;
  let sectionLevel = 0;

  lines.forEach((line, index) => {
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      if (inSection && heading[1].length <= sectionLevel) inSection = false;
      if (/\blicen[cs]es?\b/i.test(heading[2])) {
        inSection = true;
        sectionLevel = heading[1].length;
        return;
      }
    }
    // Badges whose label states a license (dynamic /github/license/ badges always match the file)
    const isBadge = /shields\.io\/badge\/licen[cs]e/i.test(line);
    if (inSection || isBadge) claims.push({ index, text: line, isBadge });
  });
  return claims;
}

export function checkLicense(readme: string, readmeFile: string, repoPath: string): DriftItem[] {
  const claims = licenseClaimLines(readme);
  const claimed = claims.flatMap((c) =>
    LICENSES.filter((l) => l.mention.test(c.text)).map((license) => ({ license, claim: c }))
  );
  if (claimed.length === 0) return [];

  const licenseFile = detectLicenseFile(repoPath);
  if (!licenseFile) {
    const first = claimed[0];
    return [
      makeDrift({
        id: 'license-missing',
        title: `README says ${first.license.name}, but there is no LICENSE file`,
        category: 'LICENSE_MISMATCH',
        severity: 'MEDIUM',
        docFile: readmeFile,
        docLineRange: `L${first.claim.index + 1}`,
        docSnippet: first.claim.text.trim(),
        codeSnippet: '// No LICENSE, LICENCE or COPYING file in the repository root',
        explanation: 'The README states a license, but the repository has no license file, so the terms are legally unclear.',
        newcomerImpact: 'Contributors and users cannot confirm under which terms they may use the code.',
        suggestedDocFix: `Add a LICENSE file containing the ${first.license.name} text.`,
      }),
    ];
  }

  const actual = licenseFile.license;
  if (!actual || claimed.some((c) => c.license.id === actual.id)) return [];

  // Rewrite the claim in prose; badge URLs encode the label so they are left for a manual edit
  const drifts: DriftItem[] = [];
  const seenLines = new Set<number>();
  for (const { license, claim } of claimed) {
    if (seenLines.has(claim.index)) continue;
    seenLines.add(claim.index);
    const fixedLine = claim.isBadge ? null : claim.text.replace(license.mention, actual.name);
    drifts.push(
      makeDrift({
        id: `license-mismatch-${claim.index + 1}`,
        title: `README says ${license.name}, but LICENSE is ${actual.name}`,
        category: 'LICENSE_MISMATCH',
        severity: 'MEDIUM',
        docFile: readmeFile,
        docLineRange: `L${claim.index + 1}`,
        codeFile: licenseFile.file,
        codeLineRange: 'L1',
        docSnippet: claim.text.trim(),
        codeSnippet: `${licenseFile.file}: ${actual.name}`,
        explanation: `The README states ${license.name}, but ${licenseFile.file} contains the ${actual.name} license text.`,
        newcomerImpact: 'Users may rely on terms that do not actually apply to the code.',
        suggestedDocFix: fixedLine?.trim() || `Update the license badge to ${actual.name}.`,
        fixes: fixedLine && fixedLine !== claim.text ? [{ type: 'replace', find: claim.text, replace: fixedLine }] : undefined,
      })
    );
  }
  return drifts;
}
