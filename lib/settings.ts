import fs from 'fs';
import path from 'path';
import { DRIFT_SYSTEM_PROMPT, REMEDIATION_SYSTEM_PROMPT } from './prompts';
import { Settings, sanitizeSettings } from './settingsSchema';

// Saved next to the project (gitignored) so settings survive restarts.
const SETTINGS_PATH = path.join(process.cwd(), '.docdrift', 'settings.json');

// Environment variables only change the defaults; saved settings take precedence.
export function getDefaultSettings(): Settings {
  return {
    lmStudioEndpoint: process.env.LMSTUDIO_ENDPOINT || 'http://localhost:1234/v1',
    model: '',
    requestTimeoutSec: Math.round((Number(process.env.LMSTUDIO_TIMEOUT_MS) || 300000) / 1000),
    temperature: 0.1,
    analysisMode: 'auto',
    analysisMaxTokens: 4000,
    readmeCharsForAnalysis: 3500,
    filesForAnalysis: 8,
    charsPerFile: 1500,
    analysisPrompt: DRIFT_SYSTEM_PROMPT,
    remediationMode: 'auto',
    remediationMaxTokens: 6000,
    maxReadmeCharsForRewrite: 15000,
    remediationPrompt: REMEDIATION_SYSTEM_PROMPT,
    cloneTimeoutSec: 60,
    maxScanDepth: 5,
    maxCodeFiles: 300,
    maxFileSizeKb: 200,
    enableDiffViewer: true,
    enableContextTooltips: true,
    checkCliFlags: true,
    checkLinks: true,
    maxLinksToCheck: 40,
    linkTimeoutSec: 8,
    checkSecrets: true,
    checkLicense: true,
    enableGithubPr: true,
  };
}

export function loadSettings(): Settings {
  const defaults = getDefaultSettings();
  try {
    const raw = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
    return sanitizeSettings(raw, defaults).settings;
  } catch {
    return defaults;
  }
}

export function saveSettings(settings: Settings): void {
  fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
  fs.writeFileSync(SETTINGS_PATH, `${JSON.stringify(settings, null, 2)}\n`);
}
