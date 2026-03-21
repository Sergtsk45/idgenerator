/**
 * @file: _openai.ts
 * @description: OpenAI client singleton and work-message normalization utility
 * @dependencies: server/storage.ts, openai
 * @created: 2026-03-18
 */

import OpenAI from 'openai';
import { storage } from '../storage';

// ── Client ──────────────────────────────────────────────────────────────────

let openaiClient: OpenAI | null = null;

/** Returns a lazily-initialised OpenAI client, or null when the API key is absent. */
export function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!apiKey) return null;
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }
  return openaiClient;
}

// ── Normalization ────────────────────────────────────────────────────────────

/**
 * Uses OpenAI to parse a raw worker message and extract structured work-log data:
 * workCode, quantity, date, location.
 */
export async function normalizeWorkMessage(messageRaw: string, objectId: number) {
  const openai = getOpenAIClient();
  if (!openai) {
    throw new Error('OpenAI API key is not configured (AI_INTEGRATIONS_OPENAI_API_KEY).');
  }

  const works = await storage.getWorks(objectId);
  const worksContext = works
    .map((w) => `${w.code}: ${w.description} (${w.unit})`)
    .join('\n');

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are a construction assistant. Extract data from the worker's message.
Available Works (BoQ):
${worksContext}

Return JSON with:
- workCode (best match from BoQ)
- quantity (number)
- date (YYYY-MM-DD, assume current year if not specified)
- location (string)

If no work matches, set workCode to null.`,
      },
      { role: 'user', content: messageRaw },
    ],
    response_format: { type: 'json_object' },
  });

  return JSON.parse(completion.choices[0].message.content || '{}');
}
