import { GoogleGenAI } from '@google/genai';
import { LMStudioStatus } from './types';

export const TARGET_MODEL_NAME = 'gemma-4-26b-a4b-it';
// Gemma only: the hackathon track requires Gemma to do the real AI work, so never fall back to a closed model.
export const FALLBACK_CLOUD_MODELS = ['gemma-4-26b-a4b-it'];

function getGenAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// preferredModel '' means auto: the first Gemma model LM Studio lists, else the available Gemma 4 cloud model.
export async function checkLMStudioHealth(endpoint: string, preferredModel = ''): Promise<LMStudioStatus> {
  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1800);
  try {
    const res = await fetch(`${endpoint.replace(/\/$/, '')}/models`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      cache: 'no-store',
    });

    if (res.ok) {
      const data = await res.json();
      const latency = Date.now() - startTime;
      const models: string[] = (data.data || []).map((m: any) => m.id).filter(Boolean);
      const chatModels = models.filter((id) => !/embed/i.test(id));
      const autoModel = chatModels.find((id) => id.toLowerCase().includes('gemma')) || chatModels[0] || TARGET_MODEL_NAME;

      return {
        connected: true,
        endpoint,
        model: preferredModel || autoModel,
        availableModels: models,
        latencyMs: latency,
      };
    }
  } catch {
    // Local LM Studio not running; fall through to Gemma 4 Cloud Bridge if GEMINI_API_KEY is available
  } finally {
    clearTimeout(timeoutId);
  }

  // Fallback to available Gemma 4 model via @google/genai when testing without local LM Studio
  if (process.env.GEMINI_API_KEY) {
    const activeModel =
      preferredModel && FALLBACK_CLOUD_MODELS.includes(preferredModel) ? preferredModel : TARGET_MODEL_NAME;
    return {
      connected: true,
      endpoint: `${endpoint} (Gemma 4 Cloud Active)`,
      model: activeModel,
      availableModels: FALLBACK_CLOUD_MODELS,
      latencyMs: Math.max(8, Date.now() - startTime),
    };
  }

  return {
    connected: false,
    endpoint,
    model: preferredModel || TARGET_MODEL_NAME,
    availableModels: [],
    error: `Cannot reach LM Studio at ${endpoint}. Make sure its local server is running.`,
  };
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
  // 1. Try local LM Studio endpoint first unless endpoint explicitly indicates Cloud Bridge
  if (!endpoint.includes('Gemma 4 Cloud Active')) {
    const controller = new AbortController();
    const localTimeout = Math.min(timeoutMs, 2500);
    const timeoutId = setTimeout(() => controller.abort(), localTimeout);
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

      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content || '';
        return {
          content: text,
          model: data.model || model,
        };
      }
    } catch {
      // Fall through to Gemma 4 via @google/genai if available
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // 2. Use Gemma 4 via @google/genai SDK on the server side
  const ai = getGenAIClient();
  if (!ai) {
    throw new Error(`Cannot reach LM Studio at ${endpoint} and no GEMINI_API_KEY is configured.`);
  }

  const systemMsg = messages.find((m) => m.role === 'system')?.content || '';
  const userMsg = messages
    .filter((m) => m.role !== 'system')
    .map((m) => m.content)
    .join('\n\n');
  const combinedPrompt = systemMsg ? `System Instructions:\n${systemMsg}\n\nTask:\n${userMsg}` : userMsg;

  const candidateModels = [
    model && !model.includes('12b') ? model : 'gemma-4-26b-a4b-it',
    'gemma-4-26b-a4b-it',
  ].filter((m, idx, arr) => Boolean(m) && arr.indexOf(m) === idx);

  let lastError: any = null;
  for (const candidate of candidateModels) {
    try {
      const perAttemptTimeout = Math.min(timeoutMs || 60000, 45000);
      const response = await Promise.race([
        ai.models.generateContent({
          model: candidate,
          contents: combinedPrompt,
          config: {
            temperature,
            maxOutputTokens: Math.min(maxTokens || 2048, 2048),
          },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`${candidate} timed out after ${perAttemptTimeout}ms`)), perAttemptTimeout)
        ),
      ]);
      const text = response.text || '';
      if (text.trim()) {
        return {
          content: text,
          model: candidate,
        };
      }
    } catch (err: any) {
      lastError = err;
    }
  }

  throw new Error(lastError?.message || 'Gemma 4 model request failed');
}
