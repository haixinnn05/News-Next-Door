import { config } from "../config.ts";
import { HttpError } from "../lib/util.ts";

/** Minimal xAI (Grok) chat-completions client with JSON-schema structured output. */
export async function grokJson<T>(opts: {
  system: string;
  user: string;
  schemaName: string;
  schema: Record<string, unknown>;
  temperature?: number;
}): Promise<{ data: T; model: string }> {
  if (!config.grok.enabled) throw new HttpError(503, "XAI_API_KEY is not configured.");
  const res = await fetch(`${config.grok.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.grok.apiKey}` },
    body: JSON.stringify({
      model: config.grok.model,
      temperature: opts.temperature ?? 0,
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
    return { data: JSON.parse(content) as T, model: body.model ?? config.grok.model };
  } catch {
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
