import { LMStudioStatus } from './types';

export const TARGET_MODEL_NAME = 'gemma-4-12b';

// preferredModel '' means auto: the first Gemma model LM Studio lists, else the first model.
export async function checkLMStudioHealth(endpoint: string, preferredModel = ''): Promise<LMStudioStatus> {
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
        model: preferredModel || TARGET_MODEL_NAME,
        availableModels: [],
        error: `HTTP ${res.status}: ${res.statusText}`,
      };
    }

    const data = await res.json();
    const latency = Date.now() - startTime;
    const models: string[] = (data.data || []).map((m: any) => m.id).filter(Boolean);
    const chatModels = models.filter((id) => !/embed/i.test(id));

    // Look for gemma model if available
    const autoModel = chatModels.find((id) => id.toLowerCase().includes('gemma')) || chatModels[0] || TARGET_MODEL_NAME;

    return {
      connected: true,
      endpoint,
      model: preferredModel || autoModel,
      availableModels: models,
      latencyMs: latency,
    };
  } catch (err: any) {
    return {
      connected: false,
      endpoint,
      model: preferredModel || TARGET_MODEL_NAME,
      availableModels: [],
      error:
        err.name === 'AbortError'
          ? 'Timed out connecting to LM Studio'
          : `Cannot reach LM Studio at ${endpoint}. Make sure its local server is running.`,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function queryGemmaLMStudio({
  messages,
  endpoint,
  model,
  temperature,
  maxTokens,
  timeoutMs,
}: {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  endpoint: string;
  model: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
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
  } catch (err: any) {
    console.warn('[DocDrift] LM Studio request failed or timed out:', err);
    if (err.name === 'AbortError') {
      throw new Error(`the model did not answer within ${Math.round(timeoutMs / 1000)}s (raise the request timeout in Settings)`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
