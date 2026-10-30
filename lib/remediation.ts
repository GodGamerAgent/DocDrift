import { DriftItem } from './types';
import { checkLMStudioHealth, queryGemmaLMStudio } from './lmstudio';
import { Settings } from './settingsSchema';

function stripOuterFence(text: string): string {
  const match = text.trim().match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i);
  return match ? match[1] : text.trim();
}

// Rule-based patch: the one drift kind that can be fixed mechanically is an undocumented env var.
function applyRuleBasedFixes(
  readme: string,
  drifts: DriftItem[],
  modelNote = ''
): { fixedReadme: string; summary: string } {
  const envLines = new Set<string>();
  for (const drift of drifts) {
    if (drift.category !== 'ENV_VARIABLE') continue;
    for (const line of drift.suggestedDocFix.split('\n')) {
      const match = line.trim().match(/^([A-Z_][A-Z0-9_]*)=/);
      if (match && !new RegExp(`\\b${match[1]}\\b`).test(readme)) envLines.add(`${match[1]}=`);
    }
  }

  const manualCount = drifts.filter((d) => d.category !== 'ENV_VARIABLE').length;
  const manualNote =
    (manualCount > 0 ? ` ${manualCount} other issue${manualCount === 1 ? ' needs' : 's need'} a manual edit.` : '') + modelNote;

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
  drifts: DriftItem[],
  settings: Settings
): Promise<{ fixedReadme: string; summary: string }> {
  if (drifts.length === 0) {
    return { fixedReadme: readme, summary: 'No drift found, so there is nothing to fix.' };
  }
  if (settings.remediationMode === 'rules') {
    return applyRuleBasedFixes(readme, drifts);
  }

  let modelError: string;
  const lmStatus = await checkLMStudioHealth(settings.lmStudioEndpoint, settings.model);
  if (!lmStatus.connected) {
    modelError = lmStatus.error || 'LM Studio is not reachable';
  } else if (readme.length > settings.maxReadmeCharsForRewrite) {
    modelError = `the README is longer than the ${settings.maxReadmeCharsForRewrite}-character rewrite limit`;
  } else {
    const driftList = drifts
      .map(
        (d, i) =>
          `${i + 1}. [${d.category}] ${d.title}\n   Outdated: ${d.docSnippet}\n   Current code: ${d.codeSnippet}\n   Suggested fix: ${d.suggestedDocFix}`
      )
      .join('\n');

    try {
      const res = await queryGemmaLMStudio({
        endpoint: settings.lmStudioEndpoint,
        model: lmStatus.model,
        messages: [
          { role: 'system', content: settings.remediationPrompt },
          { role: 'user', content: `Detected drifts:\n${driftList}\n\nREADME to fix:\n${readme}` },
        ],
        temperature: settings.temperature,
        maxTokens: settings.remediationMaxTokens,
        timeoutMs: settings.requestTimeoutSec * 1000,
      });
      const fixedReadme = stripOuterFence(res.content);
      // Guard against truncated or off-task output replacing the whole README
      if (fixedReadme.length >= readme.length * 0.5) {
        return { fixedReadme: `${fixedReadme}\n`, summary: `README rewritten by ${res.model} to resolve ${drifts.length} drift${drifts.length === 1 ? '' : 's'}.` };
      }
      modelError = 'the model output looked truncated';
    } catch (err: any) {
      modelError = err.message || 'the model request failed';
    }
  }

  if (settings.remediationMode === 'model') {
    return { fixedReadme: readme, summary: `No patch: model rewrite failed (${modelError}).` };
  }
  return applyRuleBasedFixes(readme, drifts, ` Model rewrite unavailable (${modelError}).`);
}
