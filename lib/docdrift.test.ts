import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDiffBlocks, changedLineIds, composeReadme, driftsForBlock, sourceRef } from './diffModel';
import { auditCliFlags } from './checks/cliFlags';
import { extractLinks } from './checks/links';
import { findSecrets } from './checks/secrets';
import { checkLicense } from './checks/license';
import { applyFixes } from './applyFixes';
import { auditApiDocs } from './checks/apiDocs';
import { calculateMetrics } from './metrics';
import { SAMPLE_REPOS } from './sampleRepos';

test('Feature 1: Side-by-Side Diff Viewer builds blocks and toggles line-by-line accept/reject accurately', () => {
  const original = `# Project\nRun old command --port 8080\nKeep this line\n`;
  const fixed = `# Project\nRun new command --listen-addr 0.0.0.0:8080\nKeep this line\n`;

  const blocks = buildDiffBlocks(original, fixed);
  const allIds = changedLineIds(blocks);
  assert.equal(allIds.length, 2);

  // Accept all changes -> matches fixed README
  assert.equal(composeReadme(blocks, new Set(allIds), true), fixed);

  // Reject all changes -> restores original README
  assert.equal(composeReadme(blocks, new Set(), true), original);

  // Partial line-by-line toggle: accept addition, reject removal -> keeps both lines
  const changeBlock = blocks.find((b) => b.kind === 'change');
  assert.ok(changeBlock && changeBlock.kind === 'change');
  const onlyAdded = new Set([changeBlock.added[0].id]);
  const composedBoth = composeReadme(blocks, onlyAdded, true);
  assert.ok(composedBoth.includes('Run old command --port 8080'));
  assert.ok(composedBoth.includes('Run new command --listen-addr 0.0.0.0:8080'));
});

test('Feature 2: Context Tooltips ("Why it Changed") cite exact file:line (e.g. auth.py:42) and match diff blocks', () => {
  const cloudAuth = SAMPLE_REPOS['cloud-auth-py'];
  const authDrift = cloudAuth.expectedDrifts[0];
  assert.equal(sourceRef(authDrift), 'auth.py:42');

  const blocks = buildDiffBlocks(cloudAuth.readmeContent, cloudAuth.fixedReadmeContent);
  const changeBlocks = blocks.filter((b): b is Extract<typeof b, { kind: 'change' }> => b.kind === 'change');
  assert.ok(changeBlocks.length >= 3);

  const matchedReasons = changeBlocks.flatMap((b) => driftsForBlock(b, cloudAuth.expectedDrifts));
  assert.ok(matchedReasons.some((d) => sourceRef(d) === 'auth.py:42'));
  assert.ok(matchedReasons.some((d) => sourceRef(d) === 'LICENSE:1'));
});

test('Feature 3: CLI Flag & Argument Auditor detects removed, renamed, and newly added flags and updates ## Usage', () => {
  const readme = `# CLI App\n\n## Usage\n\`\`\`bash\nmycli deploy --old-port 8080 --deprecated-flag\n\`\`\`\n`;
  const codeFiles = [
    {
      file: 'src/cli.ts',
      content: `
import { Command } from 'commander';
const program = new Command();
program
  .command('deploy')
  .requiredOption('--region <region>', 'Target deployment region')
  .option('--new-port <number>', 'Port to bind')
  .option('--audit-trail <file>', 'Write audit log');
`,
    },
  ];

  const drifts = auditCliFlags(readme, 'README.md', codeFiles);
  assert.ok(drifts.some((d) => d.id === 'cli-renamed-old-port' && d.title.includes('--new-port')));
  assert.ok(drifts.some((d) => d.id === 'cli-removed-deprecated-flag'));
  assert.ok(drifts.some((d) => d.id === 'cli-added-region' && d.severity === 'HIGH'));
  assert.ok(drifts.some((d) => d.id === 'cli-added-audit-trail'));

  const allFixes = drifts.flatMap((d) => d.fixes ?? []);
  const patched = applyFixes(readme, allFixes);
  assert.ok(patched.applied >= 3);
  assert.ok(patched.text.includes('--new-port'));
  assert.ok(patched.text.includes('- `--region <region>` (deploy): Target deployment region'));
});

test('Feature 4: Dead Link & Broken Badge Scanner extracts badges, Discord invites, relative files, and external URLs', () => {
  const md = `# Docs
[![Build](https://img.shields.io/badge/build-failing-red)](https://example.com)
Join [Discord](https://discord.gg/expired123)
Read [Guide](./docs/missing.md)
Visit https://nonexistent-domain-docdrift-test.invalid/api
`;
  const links = extractLinks(md);
  assert.ok(links.some((l) => l.isImage && l.url.includes('shields.io/badge/build-failing-red')));
  assert.ok(links.some((l) => l.url.includes('discord.gg/expired123')));
  assert.ok(links.some((l) => l.url === './docs/missing.md'));
  assert.ok(links.some((l) => l.url.includes('nonexistent-domain-docdrift-test.invalid')));
});

test('Feature 5: Secret & License Leak Detector catches hardcoded keys and root LICENSE mismatches', () => {
  const md = `# Quickstart
\`\`\`bash
export AWS_ACCESS_KEY_ID="AKIAIOSFODNN7EXAMPLE"
export GITHUB_TOKEN="ghp_1234567890abcdefghijklmnopqrstuvwxyzAB"
\`\`\`

## License
Distributed under the MIT License.
`;
  const secretDrifts = findSecrets(md, 'README.md');
  assert.equal(secretDrifts.length, 2);
  assert.ok(secretDrifts[0].docSnippet.includes('AKIA…LE'));

  const licenseDrifts = checkLicense(md, 'README.md', process.cwd());
  assert.equal(licenseDrifts.length, 1);
  assert.equal(licenseDrifts[0].category, 'LICENSE_MISMATCH');
  assert.ok(licenseDrifts[0].title.includes('Apache 2.0'));

  const combinedFixes = [...secretDrifts, ...licenseDrifts].flatMap((d) => d.fixes ?? []);
  const remediated = applyFixes(md, combinedFixes);
  assert.ok(!remediated.text.includes('AKIAIOSFODNN7EXAMPLE'));
  assert.ok(remediated.text.includes('<AWS_ACCESS_KEY_ID>'));
  assert.ok(remediated.text.includes('Apache 2.0'));
});

test('Health metrics recalculate accurately as drifts are resolved', () => {
  const sampleDrifts = SAMPLE_REPOS['cloud-auth-py'].expectedDrifts;
  const initial = calculateMetrics(sampleDrifts);
  assert.ok(initial.overallScore < 50);
  assert.equal(initial.readinessForContributors, 'BROKEN');

  const resolvedAll = calculateMetrics([]);
  assert.equal(resolvedAll.overallScore, 100);
  assert.equal(resolvedAll.readinessForContributors, 'READY');
});

test('Feature 6: API Docs (docs/api.md) Auditor detects endpoint & SDK signature drift and builds full diffs', () => {
  const cloudAuth = SAMPLE_REPOS['cloud-auth-py'];
  assert.equal(cloudAuth.apiDocFile, 'docs/api.md');
  assert.ok(cloudAuth.expectedApiDrifts.length >= 5);
  assert.equal(sourceRef(cloudAuth.expectedApiDrifts[0]), 'api_server.py:24');

  const apiBlocks = buildDiffBlocks(cloudAuth.apiDocContent, cloudAuth.fixedApiDocContent);
  const apiIds = changedLineIds(apiBlocks);
  assert.ok(apiIds.length > 0);
  assert.equal(composeReadme(apiBlocks, new Set(apiIds), true), cloudAuth.fixedApiDocContent);

  const codeFiles = Object.entries(cloudAuth.codeFiles).map(([file, content]) => ({ file, content }));
  const detectedApiDrifts = auditApiDocs(cloudAuth.apiDocContent, 'docs/api.md', codeFiles);
  assert.ok(detectedApiDrifts.some((d) => d.category === 'API_ENDPOINT'));
  assert.ok(detectedApiDrifts.some((d) => d.category === 'FUNCTION_SIGNATURE'));
});

