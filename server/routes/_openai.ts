/**
 * @file: _openai.ts
 * @description: AI client singleton (OpenAI или DeepSeek) и утилиты нормализации.
 *   Приоритет: DeepSeek > OpenAI. Оба используют совместимый API.
 * @dependencies: server/storage.ts, openai
 * @created: 2026-03-18
 */

import OpenAI from 'openai';
import { storage } from '../storage';
import type { SourceDataDto } from '@shared/routes';

// ── Client ──────────────────────────────────────────────────────────────────

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1';

let aiClient: OpenAI | null = null;
let aiProvider: 'deepseek' | 'openai' | null = null;

/**
 * Возвращает lazily-инициализированный AI-клиент.
 * Приоритет: DeepSeek (AI_INTEGRATIONS_DEEPSEEK_API_KEY) → OpenAI (AI_INTEGRATIONS_OPENAI_API_KEY).
 * Возвращает null если ни один ключ не задан.
 */
export function getOpenAIClient(): OpenAI | null {
  const deepseekKey = process.env.AI_INTEGRATIONS_DEEPSEEK_API_KEY;
  const openaiKey   = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

  const newProvider = deepseekKey ? 'deepseek' : openaiKey ? 'openai' : null;
  if (!newProvider) return null;

  // Пересоздаём клиент при смене провайдера (например, при hot-reload)
  if (!aiClient || aiProvider !== newProvider) {
    if (newProvider === 'deepseek') {
      aiClient = new OpenAI({ apiKey: deepseekKey, baseURL: DEEPSEEK_BASE_URL });
    } else {
      aiClient = new OpenAI({
        apiKey: openaiKey,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });
    }
    aiProvider = newProvider;
  }

  return aiClient;
}

/** Возвращает имя модели для активного провайдера. */
export function getAIModel(): string {
  return aiProvider === 'deepseek' ? 'deepseek-chat' : 'gpt-4o';
}

function requireClient(): OpenAI {
  const client = getOpenAIClient();
  if (!client) {
    throw new Error(
      'AI API key не настроен. Задайте AI_INTEGRATIONS_DEEPSEEK_API_KEY или AI_INTEGRATIONS_OPENAI_API_KEY в .env.',
    );
  }
  return client;
}

// ── Normalization ────────────────────────────────────────────────────────────

/**
 * Uses OpenAI to parse a raw worker message and extract structured work-log data:
 * workCode, quantity, date, location.
 */
export async function normalizeWorkMessage(messageRaw: string, objectId: number) {
  const openai = requireClient();

  const works = await storage.getWorks(objectId);
  const worksContext = works
    .map((w) => `${w.code}: ${w.description} (${w.unit})`)
    .join('\n');

  const completion = await openai.chat.completions.create({
    model: getAIModel(),
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

// ── Source data extraction ───────────────────────────────────────────────────

const EXTRACTION_SYSTEM_PROMPT = `Ты — ассистент для строительной документации. Из текста договора или другого строительного документа извлеки реквизиты и верни строго JSON-объект.

Структура ответа:
{
  "object": { "title": string, "address": string, "city": string },
  "parties": {
    "customer":  { "fullName": string, "shortName"?: string, "inn"?: string, "kpp"?: string, "ogrn"?: string, "sroFullName"?: string, "sroShortName"?: string, "sroOgrn"?: string, "sroInn"?: string, "addressLegal"?: string, "phone"?: string, "email"?: string },
    "builder":   { ...те же поля... },
    "designer":  { ...те же поля... }
  },
  "persons": {
    "developer_rep":      { "personName": string, "position"?: string, "basisText"?: string },
    "contractor_rep":     { "personName": string, "position"?: string, "basisText"?: string },
    "supervisor_rep":     { "personName": string, "position"?: string, "basisText"?: string },
    "rep_customer_control": { "personName": string, "position"?: string, "basisText"?: string },
    "rep_builder":        { "personName": string, "position"?: string, "basisText"?: string },
    "rep_builder_control":{ "personName": string, "position"?: string, "basisText"?: string },
    "rep_designer":       { "personName": string, "position"?: string, "basisText"?: string },
    "rep_work_performer": { "personName": string, "position"?: string, "basisText"?: string }
  }
}

Правила:
- customer = Заказчик, builder = Подрядчик/Генподрядчик, designer = Проектировщик.
- Если роль в документе не указана явно — оставь поле с пустыми строками (не null).
- ИНН: 10 или 12 цифр; ОГРН/ОГРНИП: 13 или 15 цифр; КПП: 9 цифр.
- personName — ФИО через пробел, basisText — текст основания (напр. "Устава", "доверенности №5").
- Для полей, которых нет в документе, используй пустую строку "".
- title объекта — краткое название, address — адрес стройки, city — город.`;

/**
 * Использует GPT-4o для извлечения реквизитов из текста документа.
 * Возвращает Partial<SourceDataDto> — поля без данных содержат пустые строки.
 */
export async function extractSourceDataFromText(text: string): Promise<Partial<SourceDataDto>> {
  const openai = requireClient();

  const completion = await openai.chat.completions.create({
    model: getAIModel(),
    messages: [
      { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
      { role: 'user', content: `Документ:\n\n${text}` },
    ],
    response_format: { type: 'json_object' },
    temperature: 0,
  });

  return JSON.parse(completion.choices[0].message.content || '{}') as Partial<SourceDataDto>;
}
