import { LMStudioStatus } from './types';

export const DEFAULT_LMSTUDIO_ENDPOINT = 'http://localhost:1234/v1';
export const TARGET_MODEL_NAME = 'gemma-4-12b';

export async function checkLMStudioHealth(endpoint: string = DEFAULT_LMSTUDIO_ENDPOINT): Promise<LMStudioStatus> {
  const startTime = Date.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(`${endpoint.replace(/\/$/, '')}/models`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

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
    const models = (data.data || []).map((m: any) => m.id);

    // Look for gemma model if available
    const gemmaMatch = models.find((id: string) => id.toLowerCase().includes('gemma')) || models[0] || TARGET_MODEL_NAME;

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
  }
}

export async function queryGemmaLMStudio({
  messages,
  endpoint = DEFAULT_LMSTUDIO_ENDPOINT,
  model = TARGET_MODEL_NAME,
  temperature = 0.2,
  maxTokens = 2000,
}: {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  endpoint?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<{ content: string; model: string; source: 'LM_STUDIO_LIVE' | 'GEMMA_LOCAL_SIMULATOR' }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

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
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`LM Studio returned status ${res.status}`);
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '';
    return {
      content: text,
      model: data.model || model,
      source: 'LM_STUDIO_LIVE',
    };
  } catch (err) {
    console.warn('[DocDrift] LM Studio connection failed or timed out. Falling back to internal Gemma reasoning engine:', err);
    throw err;
  }
}
