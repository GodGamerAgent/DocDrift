import { NextResponse } from 'next/server';
import * as Diff from 'diff';
import { SAMPLE_REPOS } from '@/lib/sampleRepos';
import { remediateReadme } from '@/lib/remediation';
import { loadSettings } from '@/lib/settings';
import { DriftItem, RemediationResult } from '@/lib/types';

const MAX_README_CHARS = 200_000;

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON' }, { status: 400 });
  }

  try {
    const { sampleId, readme, readmeFile, drifts, docTarget } = body ?? {};
    const isApi = docTarget === 'api' || (typeof readmeFile === 'string' && /api/i.test(readmeFile));

    let originalReadme: string;
    let fixedReadme: string;
    let remediationSummary: string;
    let fileName = isApi ? 'docs/api.md' : 'README.md';

    if (typeof sampleId === 'string' && SAMPLE_REPOS[sampleId]) {
      const sample = SAMPLE_REPOS[sampleId];
      if (isApi) {
        fileName = sample.apiDocFile || 'docs/api.md';
        originalReadme = sample.apiDocContent;
        fixedReadme = sample.fixedApiDocContent;
        const count = sample.expectedApiDrifts.length;
        remediationSummary =
          count === 0
            ? 'No API drift found, so there is nothing to fix.'
            : `Fixes all ${count} outdated endpoints, signatures, and examples in ${fileName}.`;
      } else {
        originalReadme = sample.readmeContent;
        fixedReadme = sample.fixedReadmeContent;
        const count = sample.expectedDrifts.length;
        remediationSummary =
          count === 0 ? 'No drift found, so there is nothing to fix.' : `Fixes all ${count} outdated instructions in the README.`;
      }
    } else if (typeof readme === 'string' && readme.trim()) {
      if (readme.length > MAX_README_CHARS) {
        return NextResponse.json({ error: 'Documentation file is too large to remediate' }, { status: 413 });
      }
      const driftItems: DriftItem[] = Array.isArray(drifts) ? drifts.filter((d) => d && typeof d === 'object') : [];
      originalReadme = readme;
      ({ fixedReadme, summary: remediationSummary } = await remediateReadme(readme, driftItems, loadSettings()));
      if (typeof readmeFile === 'string' && readmeFile.trim()) fileName = readmeFile;
    } else {
      return NextResponse.json({ error: 'No documentation content found to fix' }, { status: 400 });
    }

    // Generate unified diff (empty when there is nothing to change)
    const gitDiff =
      fixedReadme === originalReadme
        ? ''
        : Diff.createPatch(fileName, originalReadme, fixedReadme, 'original', 'fixed');

    const result: RemediationResult = { originalReadme, fixedReadme, gitDiff, remediationSummary };
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Fix API error:', err);
    return NextResponse.json({ error: err.message || 'Failed to remediate documentation' }, { status: 500 });
  }
}
