import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { env, requireGemini, AiQuotaError } from '@/lib/env';

function isQuotaError(err: unknown): boolean {
  const e = err as { status?: number; code?: number; message?: string };
  return e?.status === 429 || e?.code === 429 || /RESOURCE_EXHAUSTED|"code":\s*429|exceeded your current quota/i.test(e?.message || '');
}

async function guard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (isQuotaError(err)) throw new AiQuotaError('Gemini');
    throw err;
  }
}

/**
 * Thin Gemini wrapper: embeddings and schema-constrained JSON generation. Errors surface to the
 * caller (no silent fallback to canned text).
 */

let client: GoogleGenAI | null = null;
function ai(): GoogleGenAI {
  if (!client) client = new GoogleGenAI({ apiKey: requireGemini().GEMINI_API_KEY });
  return client;
}

export const EMBEDDING_DIMENSIONS = 768;

export async function embedTexts(texts: string[], taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY'): Promise<number[][]> {
  const out: number[][] = [];
  const BATCH = 50;
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    const res = await guard(() => ai().models.embedContent({
      model: env().GEMINI_EMBED_MODEL,
      contents: batch,
      config: { taskType, outputDimensionality: EMBEDDING_DIMENSIONS },
    }));
    const vectors = (res.embeddings || []).map((e) => normalize(e.values || []));
    if (vectors.length !== batch.length) throw new Error('Gemini returned an unexpected number of embeddings.');
    out.push(...vectors);
  }
  return out;
}

/** Truncated (MRL) Gemini embeddings must be re-normalised before cosine search. */
function normalize(v: number[]): number[] {
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / n);
}

export async function generateJson<T extends z.ZodTypeAny>(opts: {
  schema: T;
  system: string;
  prompt: string;
  model?: string;
  temperature?: number;
}): Promise<z.infer<T>> {
  const res = await guard(() => ai().models.generateContent({
    model: opts.model || env().GEMINI_ANALYSIS_MODEL,
    contents: opts.prompt,
    config: {
      systemInstruction: opts.system,
      temperature: opts.temperature ?? 0.1,
      responseMimeType: 'application/json',
      responseJsonSchema: z.toJSONSchema(opts.schema, { target: 'draft-7' }),
    },
  }));
  const text = res.text;
  if (!text) throw new Error('Gemini returned an empty response.');
  return opts.schema.parse(JSON.parse(text));
}
