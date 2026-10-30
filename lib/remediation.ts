import { DocFix, DriftItem } from './types';
import { applyFixes } from './applyFixes';
import { checkLMStudioHealth, queryGemmaLMStudio } from './lmstudio';
import { Settings } from './settingsSchema';

function stripOuterFence(text: string): string {
  const match = text.trim().match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i);
  return match ? match[1] : text.trim();
}

// Fixes a drift can be repaired with mechanically. Model-reported env-var drifts carry
// no structured fixes, so their `NAME=value` suggestions are turned into Usage-style lines.
function fixesFor(drift: DriftItem): DocFix[] {
  if (drift.fixes?.length) return drift.fixes;
  if (drift.category !== 'ENV_VARIABLE') return [];
  return drift.suggestedDocFix
    .split('\n')
    .map((line) => line.trim().match(/^([A-Z_][A-Z0-9_]*)=/)?.[1])
    .filter((name): name is string => !!name)
    .map((name) => ({ type: 'appendToSection' as const, heading: 'Environment Variables', line: `- \`${name}\`` }));
}

function applyRuleBasedFixes(
  readme: string,
  drifts: DriftItem[],
  modelNote = ''
): { fixedReadme: string; summary: string } {
  let text = readme;
  let fixed = 0;
  for (const drift of drifts) {
    const result = applyFixes(text, fixesFor(drift));
    if (result.applied > 0) fixed++;
    text = result.text;
  }

  const manual = drifts.length - fixed;
  const manualNote = (manual > 0 ? ` ${manual} issue${manual === 1 ? ' needs' : 's need'} a manual edit.` : '') + modelNote;
  if (fixed === 0) {
    return { fixedReadme: readme, summary: `No automatic patch could be generated.${manualNote}` };
  }
  return { fixedReadme: text, summary: `Fixed ${fixed} issue${fixed === 1 ? '' : 's'} automatically.${manualNote}` };
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
        // Never trust the model to drop a leaked secret: scrub any that survived the rewrite
        const scrubbed = applyFixes(
          `${fixedReadme}\n`,
          drifts.filter((d) => d.category === 'SECRET_LEAK').flatMap((d) => d.fixes ?? [])
        ).text;
        return {
          fixedReadme: scrubbed,
          summary: `README rewritten by ${res.model} to resolve ${drifts.length} issue${drifts.length === 1 ? '' : 's'}.`,
        };
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
