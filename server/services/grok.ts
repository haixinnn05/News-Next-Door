import { config } from "../config.ts";
import { HttpError } from "../lib/util.ts";

/** Minimal xAI (Grok) chat-completions client with JSON-schema structured output. */
export async function grokJson<T>(opts: {
  system: string;
  user: string;
  schemaName: string;
  schema: Record<string, unknown>;
  temperature?: number;
  /** Overrides the default model. Summaries use grok-4.3. */
  model?: string;
  reasoningEffort?: "none" | "low" | "medium" | "high";
  maxTokens?: number;
}): Promise<{ data: T; model: string }> {
  if (!config.grok.enabled) throw new HttpError(503, "XAI_API_KEY is not configured.");
  const model = opts.model ?? config.grok.model;
  const res = await fetch(`${config.grok.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.grok.apiKey}` },
    body: JSON.stringify({
      model,
      temperature: opts.temperature ?? 0,
      ...(opts.reasoningEffort ? { reasoning_effort: opts.reasoningEffort } : {}),
      ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      response_format: { type: "json_schema", json_schema: { name: opts.schemaName, schema: opts.schema, strict: true } },
    }),
    signal: AbortSignal.timeout(180_000),
  });
  const body = (await res.json().catch(() => ({}))) as {
    model?: string;
    choices?: { message?: { content?: string; refusal?: string } }[];
    error?: { message?: string } | string;
  };
  if (!res.ok) {
    const msg = typeof body.error === "string" ? body.error : body.error?.message;
    throw new HttpError(502, `Grok request failed (${res.status}): ${msg ?? "unknown error"}`);
  }
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new HttpError(502, `Grok returned no content${body.choices?.[0]?.message?.refusal ? `: ${body.choices[0].message.refusal}` : ""}`);
  try {
    return { data: JSON.parse(content) as T, model: body.model ?? model };
  } catch {
    throw new HttpError(502, "Grok returned invalid JSON.");
  }
}

function responsesText(body: {
  output_text?: string;
  output?: { type?: string; text?: string; content?: string | { type?: string; text?: string }[] }[];
}): string {
  if (body.output_text?.trim()) return body.output_text;
  const parts: string[] = [];
  for (const item of body.output ?? []) {
    if (typeof item.text === "string") parts.push(item.text);
    if (typeof item.content === "string") parts.push(item.content);
    if (Array.isArray(item.content)) {
      for (const chunk of item.content) {
        if (typeof chunk === "string") parts.push(chunk);
        else if ((chunk.type === "output_text" || chunk.type === "text") && chunk.text) parts.push(chunk.text);
      }
    }
  }
  return parts.join("\n").trim();
}

function parseJsonObject<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new HttpError(502, "Grok returned invalid JSON.");
    return JSON.parse(match[0]) as T;
  }
}

/** Ask Grok to open a live page (web search) and return structured JSON. */
export async function grokWebJson<T>(opts: {
  system: string;
  user: string;
  schemaName: string;
  schema: Record<string, unknown>;
  model?: string;
  maxTokens?: number;
  allowedDomains?: string[];
}): Promise<{ data: T; model: string }> {
  if (!config.grok.enabled) throw new HttpError(503, "XAI_API_KEY is not configured.");
  const model = opts.model ?? config.grok.model;
  const res = await fetch(`${config.grok.baseUrl}/responses`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.grok.apiKey}` },
    body: JSON.stringify({
      model,
      store: false,
      instructions: opts.system,
      input: [{ role: "user", content: opts.user }],
      tools: [
        {
          type: "web_search",
          ...(opts.allowedDomains?.length ? { filters: { allowed_domains: opts.allowedDomains } } : {}),
        },
      ],
      ...(opts.maxTokens ? { max_output_tokens: opts.maxTokens } : {}),
    }),
    signal: AbortSignal.timeout(180_000),
  });
  const body = (await res.json().catch(() => ({}))) as {
    model?: string;
    output_text?: string;
    output?: { type?: string; content?: { type?: string; text?: string }[] }[];
    error?: { message?: string } | string;
  };
  if (!res.ok) {
    const msg = typeof body.error === "string" ? body.error : body.error?.message;
    throw new HttpError(502, `Grok request failed (${res.status}): ${msg ?? "unknown error"}`);
  }
  const content = responsesText(body);
  if (!content) throw new HttpError(502, "Grok returned no content.");
  try {
    return { data: parseJsonObject<T>(content), model: body.model ?? model };
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(502, "Grok returned invalid JSON.");
  }
}

const nullableString = { type: ["string", "null"] } as const;

export const TRANSLATION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: { title_zh: { type: "string" }, summary_zh: { type: "string" } },
  required: ["title_zh", "summary_zh"],
};

export async function translateCardToChinese(title: string, summary: string): Promise<{ title_zh: string; summary_zh: string }> {
  const { data } = await grokJson<{ title_zh: string; summary_zh: string }>({
    system:
      "Translate civic information from English to Simplified Chinese for residents of Queens, New York. Keep street addresses, numbers, dates, and agency names exact (addresses may stay in English). Do not add facts.",
    user: JSON.stringify({ title, summary }),
    schemaName: "card_translation",
    schema: TRANSLATION_SCHEMA,
  });
  return data;
}

const SUMMARY_LANGUAGE: Record<string, string> = {
  en: "English",
  zh: "Simplified Chinese",
  es: "Spanish",
  fr: "French",
  ja: "Japanese",
  hi: "Hindi",
  ar: "Arabic",
  ru: "Russian",
};

export interface PlainSummaryInput {
  name: string;
  brief: string | null;
  public_status: string;
  applicant: string | null;
  districts: string;
  location: string | null;
  milestone: string | null;
  actions: string[];
}

const summaryCache = new Map<string, { summary: string; model: string }>();
const SUMMARY_WORD_LIMIT = 50;
const SUMMARY_MODEL = "grok-4.3";

function capWords(text: string, max: number): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= max) return text.trim();
  const cut = words.slice(0, max).join(" ");
  const sentence = cut.match(/^[\s\S]*[.!?。！？]/);
  return (sentence?.[0] ?? cut).trim();
}

/** Rewrite one city record in plain language. Uses only the fields passed in. */
export async function summarizeApplication(input: PlainSummaryInput, language: string): Promise<{ summary: string; model: string }> {
  const languageName = SUMMARY_LANGUAGE[language];
  if (!languageName) throw new HttpError(400, "Choose a supported language.");
  if (!config.grok.enabled) throw new HttpError(503, "Plain-language summaries need a Grok key. Add XAI_API_KEY to .env and restart.");
  const key = JSON.stringify({ language, input });
  const hit = summaryCache.get(key);
  if (hit) return hit;
  const { data, model } = await grokJson<{ summary: string }>({
    system: `Explain this NYC land-use record to a neighbor in ${languageName}. At most ${SUMMARY_WORD_LIMIT} words. Only the JSON. No new facts. Plain words. Drop unexplained codes. Copy numbers exactly; do not correct them.`,
    user: JSON.stringify({
      name: input.name,
      brief: input.brief,
      status: input.public_status,
      where: input.location,
      actions: input.actions,
    }),
    schemaName: "plain_summary",
    schema: { type: "object", additionalProperties: false, properties: { summary: { type: "string" } }, required: ["summary"] },
    temperature: 0,
    model: SUMMARY_MODEL,
    reasoningEffort: "none",
    maxTokens: 120,
  });
  const summary = capWords(data.summary, SUMMARY_WORD_LIMIT);
  if (!summary) throw new HttpError(502, "Grok returned an empty summary.");
  const out = { summary, model };
  summaryCache.set(key, out);
  if (summaryCache.size > 200) {
    const oldest = summaryCache.keys().next().value;
    if (oldest) summaryCache.delete(oldest);
  }
  return out;
}

export async function translateScriptToChinese(script: string): Promise<string> {
  const { data } = await grokJson<{ script_zh: string }>({
    system:
      "Translate this short spoken civic briefing from English to natural spoken Simplified Chinese. Keep every name, street address, number, date and time exactly equivalent. Do not add or drop information.",
    user: script,
    schemaName: "script_translation",
    schema: { type: "object", additionalProperties: false, properties: { script_zh: { type: "string" } }, required: ["script_zh"] },
  });
  return data.script_zh;
}

export { nullableString };
