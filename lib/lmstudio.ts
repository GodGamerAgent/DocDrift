import { LMStudioStatus } from './types';

export const DEFAULT_LMSTUDIO_ENDPOINT = process.env.LMSTUDIO_ENDPOINT || 'http://localhost:1234/v1';
export const TARGET_MODEL_NAME = 'gemma-4-12b';
// Full analyses on a local 12B model (especially reasoning variants) can take minutes
export const LMSTUDIO_TIMEOUT_MS = Number(process.env.LMSTUDIO_TIMEOUT_MS) || 300000;

export async function checkLMStudioHealth(endpoint: string = DEFAULT_LMSTUDIO_ENDPOINT): Promise<LMStudioStatus> {
  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3500);
  try {
    const res = await fetch(`${endpoint.replace(/\/$/, '')}/models`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!res.ok) {
      return {
        connected: false,
        endpoint,
        model: TARGET_MODEL_NAME,
        availableModels: [],
        error: `HTTP ${res.status}: ${res.statusText}`,
      };
    }

    const data = await res.json();
    const latency = Date.now() - startTime;
    const models: string[] = (data.data || []).map((m: any) => m.id).filter(Boolean);

    // Look for gemma model if available
    const gemmaMatch = models.find((id) => id.toLowerCase().includes('gemma')) || models[0] || TARGET_MODEL_NAME;

    return {
      connected: true,
      endpoint,
      model: gemmaMatch,
      availableModels: models,
      latencyMs: latency,
    };
  } catch (err: any) {
    return {
      connected: false,
      endpoint,
      model: TARGET_MODEL_NAME,
      availableModels: [],
      error: err.message || 'Cannot reach LM Studio server. Ensure local server is started on port 1234.',
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function queryGemmaLMStudio({
  messages,
  endpoint = DEFAULT_LMSTUDIO_ENDPOINT,
  model = TARGET_MODEL_NAME,
  temperature = 0.2,
  maxTokens = 2000,
  timeoutMs = LMSTUDIO_TIMEOUT_MS,
}: {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  endpoint?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<{ content: string; model: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${endpoint.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!res.ok) {
      // LM Studio explains failures such as "Context size has been exceeded" in the body
      const detail = await res.text().catch(() => '');
      throw new Error(`LM Studio returned status ${res.status}${detail ? `: ${detail.slice(0, 300)}` : ''}`);
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '';
    return {
      content: text,
      model: data.model || model,
    };
  } catch (err) {
    console.warn('[DocDrift] LM Studio request failed or timed out:', err);
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
