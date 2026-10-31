import { DocFix, DriftItem } from './types';
import { applyFixes } from './applyFixes';
import { checkLMStudioHealth, queryGemmaLMStudio } from './lmstudio';
import { Settings } from './settingsSchema';

function stripOuterFence(text: string): string {
  const trimmed = text.trim();
  const exactMatch = trimmed.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i);
  if (exactMatch) return exactMatch[1];
  const embeddedMatch = trimmed.match(/^[^\n]{0,120}\n```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/i);
  if (embeddedMatch) return embeddedMatch[1];
  return trimmed;
}

const SECTION_BY_CATEGORY: Record<string, string> = {
  CLI_FLAG: 'Usage',
  ENV_VARIABLE: 'Environment Variables',
  INSTALL_STEP: 'Install',
  VERSION_MISMATCH: 'Install',
  FUNCTION_SIGNATURE: 'API',
  API_ENDPOINT: 'API',
  LICENSE_MISMATCH: 'License',
};

// Fixes a drift can be repaired with mechanically. Model-reported drifts carry
// docSnippet + suggestedDocFix or section additions that can be applied deterministically.
export function fixesFor(drift: DriftItem, readme = ''): DocFix[] {
  if (drift.fixes?.length) return drift.fixes;

  if (drift.category === 'ENV_VARIABLE') {
    const envFixes = drift.suggestedDocFix
      .split('\n')
      .map((line) => line.trim().match(/^([A-Z_][A-Z0-9_]*)=/)?.[1])
      .filter((name): name is string => !!name)
      .map((name) => ({ type: 'appendToSection' as const, heading: 'Environment Variables', line: `- \`${name}\`` }));
    if (envFixes.length > 0) return envFixes;
  }

  const find = drift.docSnippet?.trim();
  const replace = drift.suggestedDocFix?.trim();

  // 1. Direct snippet replacement when the README contains the outdated snippet
  if (
    find &&
    replace &&
    find !== replace &&
    !find.startsWith('//') &&
    (!readme || readme.includes(find)) &&
    !/^(remove|update|replace|add|change|delete|ensure|see)\b/i.test(replace)
  ) {
    return [{ type: 'replace', find, replace }];
  }

  // 2. When a model-detected drift reports a missing item (e.g. undocumented CLI flag, version, or API method),
  // append a clean Markdown bullet or snippet to the corresponding README section so the Side-by-Side Diff Viewer
  // and "Why it Changed" citation tooltip highlight the exact proposed addition.
  if (replace) {
    const heading = SECTION_BY_CATEGORY[drift.category] || 'Documentation Updates';
    const formattedLine =
      replace.startsWith('-') || replace.startsWith('#') || replace.startsWith('```')
        ? replace
        : `- **${drift.title}**: ${replace}`;
    return [{ type: 'appendToSection', heading, line: formattedLine }];
  }

  return [];
}

function applyRuleBasedFixes(
  readme: string,
  drifts: DriftItem[],
  modelNote = ''
): { fixedReadme: string; summary: string } {
  let text = readme;
  let fixed = 0;
  for (const drift of drifts) {
    const result = applyFixes(text, fixesFor(drift, text));
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

  // Always compute surgical deterministic fixes first
  const ruleResult = applyRuleBasedFixes(readme, drifts);
  if (settings.remediationMode === 'rules') {
    return ruleResult;
  }

  // In 'auto' mode, if surgical fixes already resolved the detected drifts cleanly, return immediately
  // so large online READMEs are patched in <5ms without risking truncation from full-document rewrites.
  if (settings.remediationMode === 'auto' && ruleResult.fixedReadme !== readme) {
    return ruleResult;
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
      if (fixedReadme.length >= readme.length * 0.5) {
        const ruleFixes = drifts.flatMap((d) => fixesFor(d, `${fixedReadme}\n`));
        const scrubbed = applyFixes(`${fixedReadme}\n`, ruleFixes).text;
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
