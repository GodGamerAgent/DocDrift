import { DriftItem } from './types';
import { checkLMStudioHealth, queryGemmaLMStudio } from './lmstudio';
import { REMEDIATION_SYSTEM_PROMPT } from './prompts';

// Larger READMEs would be truncated by the model's output budget, so they use the rule-based patch.
const MAX_LLM_README_CHARS = 15000;

function stripOuterFence(text: string): string {
  const match = text.trim().match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i);
  return match ? match[1] : text.trim();
}

// Rule-based patch: the one drift kind that can be fixed mechanically is an undocumented env var.
function applyRuleBasedFixes(readme: string, drifts: DriftItem[]): { fixedReadme: string; summary: string } {
  const envLines = new Set<string>();
  for (const drift of drifts) {
    if (drift.category !== 'ENV_VARIABLE') continue;
    for (const line of drift.suggestedDocFix.split('\n')) {
      const match = line.trim().match(/^([A-Z_][A-Z0-9_]*)=/);
      if (match && !new RegExp(`\\b${match[1]}\\b`).test(readme)) envLines.add(`${match[1]}=`);
    }
  }

  const manualCount = drifts.filter((d) => d.category !== 'ENV_VARIABLE').length;
  const manualNote = manualCount > 0 ? ` ${manualCount} other drift${manualCount === 1 ? ' needs' : 's need'} a manual edit (start LM Studio for AI-written fixes).` : '';

  if (envLines.size === 0) {
    return { fixedReadme: readme, summary: `No automatic patch could be generated.${manualNote}` };
  }

  const section = [
    '## Environment Variables',
    '',
    'The code reads the following environment variables:',
    '',
    '```env',
    ...Array.from(envLines),
    '```',
    '',
  ].join('\n');
  const fixedReadme = `${readme.replace(/\s*$/, '')}\n\n${section}`;
  return {
    fixedReadme,
    summary: `Documented ${envLines.size} missing environment variable${envLines.size === 1 ? '' : 's'}.${manualNote}`,
  };
}

export async function remediateReadme(
  readme: string,
  drifts: DriftItem[]
): Promise<{ fixedReadme: string; summary: string }> {
  if (drifts.length === 0) {
    return { fixedReadme: readme, summary: 'No drift detected, so there is nothing to remediate.' };
  }

  const lmStatus = await checkLMStudioHealth();
  if (lmStatus.connected && readme.length <= MAX_LLM_README_CHARS) {
    const driftList = drifts
      .map(
        (d, i) =>
          `${i + 1}. [${d.category}] ${d.title}\n   Outdated: ${d.docSnippet}\n   Current code: ${d.codeSnippet}\n   Suggested fix: ${d.suggestedDocFix}`
      )
      .join('\n');

    try {
      const res = await queryGemmaLMStudio({
        model: lmStatus.model,
        messages: [
          { role: 'system', content: REMEDIATION_SYSTEM_PROMPT },
          { role: 'user', content: `Detected drifts:\n${driftList}\n\nREADME to fix:\n${readme}` },
        ],
        temperature: 0.1,
        maxTokens: 6000,
      });
      const fixedReadme = stripOuterFence(res.content);
      // Guard against truncated or off-task output replacing the whole README
      if (fixedReadme.length >= readme.length * 0.5) {
        return { fixedReadme: `${fixedReadme}\n`, summary: `README rewritten by ${res.model} to resolve ${drifts.length} drift${drifts.length === 1 ? '' : 's'}.` };
      }
      console.warn('[DocDrift] Model remediation output looked truncated; using rule-based patch.');
    } catch (err) {
      // Fall through to rule-based fixes
    }
  }

  return applyRuleBasedFixes(readme, drifts);
}
