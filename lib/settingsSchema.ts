// Client-safe settings definitions. File IO lives in ./settings.ts (server only).

export type EngineMode = 'auto' | 'model' | 'rules';
export const ENGINE_MODES: EngineMode[] = ['auto', 'model', 'rules'];

export interface Settings {
  // Model connection
  lmStudioEndpoint: string;
  model: string; // '' = pick automatically (prefers a Gemma model)
  requestTimeoutSec: number;
  temperature: number;
  // Drift analysis
  analysisMode: EngineMode;
  analysisMaxTokens: number;
  readmeCharsForAnalysis: number;
  filesForAnalysis: number;
  charsPerFile: number;
  analysisPrompt: string;
  // README remediation
  remediationMode: EngineMode;
  remediationMaxTokens: number;
  maxReadmeCharsForRewrite: number;
  remediationPrompt: string;
  // Repository scanning
  cloneTimeoutSec: number;
  maxScanDepth: number;
  maxCodeFiles: number;
  maxFileSizeKb: number;
}

type NumberKey = { [K in keyof Settings]: Settings[K] extends number ? K : never }[keyof Settings];

export const NUMBER_LIMITS: Record<NumberKey, { min: number; max: number; step: number }> = {
  requestTimeoutSec: { min: 10, max: 3600, step: 10 },
  temperature: { min: 0, max: 2, step: 0.05 },
  analysisMaxTokens: { min: 256, max: 32768, step: 256 },
  readmeCharsForAnalysis: { min: 500, max: 100000, step: 500 },
  filesForAnalysis: { min: 0, max: 50, step: 1 },
  charsPerFile: { min: 200, max: 20000, step: 100 },
  remediationMaxTokens: { min: 256, max: 32768, step: 256 },
  maxReadmeCharsForRewrite: { min: 1000, max: 200000, step: 1000 },
  cloneTimeoutSec: { min: 10, max: 600, step: 5 },
  maxScanDepth: { min: 1, max: 20, step: 1 },
  maxCodeFiles: { min: 10, max: 5000, step: 10 },
  maxFileSizeKb: { min: 10, max: 5000, step: 10 },
};

const MAX_PROMPT_CHARS = 20000;

// Fired on window after settings are saved so the header can re-check the model connection.
export const SETTINGS_SAVED_EVENT = 'docdrift:settings-saved';

// Validates every field of `input`; invalid or missing fields keep the value from `base`.
export function sanitizeSettings(input: unknown, base: Settings): { settings: Settings; errors: string[] } {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const settings: Settings = { ...base };
  const errors: string[] = [];

  for (const key of Object.keys(NUMBER_LIMITS) as NumberKey[]) {
    if (!(key in raw)) continue;
    const { min, max } = NUMBER_LIMITS[key];
    const value = typeof raw[key] === 'number' ? (raw[key] as number) : Number(raw[key]);
    if (raw[key] === null || raw[key] === '' || !Number.isFinite(value)) {
      errors.push(`${key} must be a number`);
    } else if (value < min || value > max) {
      errors.push(`${key} must be between ${min} and ${max}`);
    } else {
      settings[key] = key === 'temperature' ? value : Math.round(value);
    }
  }

  if ('lmStudioEndpoint' in raw) {
    const value = String(raw.lmStudioEndpoint ?? '').trim();
    try {
      const url = new URL(value);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error();
      settings.lmStudioEndpoint = value.replace(/\/+$/, '');
    } catch {
      errors.push('lmStudioEndpoint must be an http(s) URL');
    }
  }

  if ('model' in raw) {
    const value = String(raw.model ?? '').trim();
    if (value.length > 200) errors.push('model name is too long');
    else settings.model = value;
  }

  for (const key of ['analysisMode', 'remediationMode'] as const) {
    if (!(key in raw)) continue;
    if (ENGINE_MODES.includes(raw[key] as EngineMode)) settings[key] = raw[key] as EngineMode;
    else errors.push(`${key} must be one of ${ENGINE_MODES.join(', ')}`);
  }

  for (const key of ['analysisPrompt', 'remediationPrompt'] as const) {
    if (!(key in raw)) continue;
    const value = typeof raw[key] === 'string' ? (raw[key] as string) : '';
    if (!value.trim()) errors.push(`${key} cannot be empty`);
    else if (value.length > MAX_PROMPT_CHARS) errors.push(`${key} must be under ${MAX_PROMPT_CHARS} characters`);
    else settings[key] = value;
  }

  return { settings, errors };
}
