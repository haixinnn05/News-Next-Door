/**
 * Plain-language city-news briefings.
 *
 * City-news briefings use the Times headline, blurb, and lead. The full article
 * is not fetched. Translations use Grok when it is on, otherwise a fallback.
 */
import fs from "node:fs";
import path from "node:path";
import { config } from "../config.ts";
import { HttpError } from "../lib/util.ts";
import { saveFile, tts } from "./audio.ts";
import { grokJson } from "./grok.ts";
import { articleById, enrichArticle, type CityArticle } from "./nyt.ts";
import { translateTexts } from "./plainTranslate.ts";

const LANGS = ["en", "zh", "es", "fr", "ja", "hi", "ar", "ru"] as const;
export type CityLang = (typeof LANGS)[number];

const LANG_NAME: Record<CityLang, string> = {
  en: "English",
  zh: "Simplified Chinese",
  es: "Spanish",
  fr: "French",
  ja: "Japanese",
  hi: "Hindi",
  ar: "Arabic",
  ru: "Russian",
};

export interface CityFacts {
  who: string | null;
  what: string | null;
  where: string | null;
  when: string | null;
}

export interface CityBriefing {
  article: CityArticle;
  summary_en: string;
  points: string[];
  facts: CityFacts;
  model: string | null;
}

export interface CityTranslation {
  lang: CityLang;
  headline: string;
  dek: string | null;
  section: string | null;
  summary: string;
  points: string[];
  facts: CityFacts;
}

const briefingCache = new Map<string, CityBriefing>();
const translationCache = new Map<string, CityTranslation>();
const listCache = new Map<string, CityArticle[]>();

function asLang(raw: string | undefined): CityLang {
  const lang = (raw ?? "en") as CityLang;
  if (!LANGS.includes(lang)) throw new HttpError(400, "Choose a supported language.");
  return lang;
}

function paragraphs(text: string): string {
  return text
    .replace(/\r/g, "")
    .split(/\n+/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n\n");
}

export function uniqueSentences(...chunks: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const chunk of chunks) {
    if (!chunk) continue;
    for (const raw of chunk.split(/(?<=[.!?。！？])\s+/)) {
      const sentence = raw.replace(/\s+/g, " ").trim();
      if (sentence.length < 12) continue;
      const key = sentence.toLowerCase().replace(/[“”"']/g, "");
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(sentence.endsWith(".") || /[.!?。！？]$/.test(sentence) ? sentence : `${sentence}.`);
    }
  }
  return out;
}

function publicArticle(article: CityArticle): CityArticle {
  return {
    id: article.id,
    headline: article.headline,
    dek: article.dek,
    lead: null,
    keywords: [],
    url: article.url,
    date: article.date,
    section: article.section,
    topic: article.topic,
    source: article.source,
  };
}

function pointsFromArticle(article: CityArticle, body: string[]): string[] {
  const fromBody = uniqueSentences(...body).filter((line) => line.length >= 40 && line.length <= 260 && !/subscribe|advertisement|newsletter|sign up/i.test(line));
  if (fromBody.length) return fromBody.slice(0, 5);
  return uniqueSentences(article.lead, article.dek).slice(0, 5);
}

export function extractiveBriefing(article: CityArticle, body: string[] = []): CityBriefing {
  const facts = pointsFromArticle(article, body);
  const opener = /[.!?。！？]$/.test(article.headline.trim()) ? article.headline.trim() : `${article.headline.trim().replace(/\.$/, "")}.`;
  const summaryBits = body.length ? body.slice(0, 3) : uniqueSentences(article.lead, article.dek);
  const summary = uniqueSentences(opener, ...summaryBits).join(" ");
  return {
    article: publicArticle(article),
    summary_en: summary,
    points: facts.length ? facts : [article.headline],
    facts: {
      who: article.keywords.find((word) => /mayor|governor|president|official|agency/i.test(word)) ?? null,
      what: article.headline,
      where: article.keywords.find((word) => /new york|queens|brooklyn|manhattan|bronx|staten/i.test(word)) ?? article.section,
      when: article.date,
    },
    model: null,
  };
}

export async function cityBriefing(id: string): Promise<CityBriefing> {
  const hit = briefingCache.get(id);
  if (hit) return hit;
  const article = await enrichArticle(await articleById(id));
  const briefing = extractiveBriefing(article);
  briefingCache.set(id, briefing);
  return briefing;
}

export async function translateBriefing(id: string, language: string): Promise<CityTranslation> {
  const lang = asLang(language);
  const key = `${id}:${lang}`;
  const hit = translationCache.get(key);
  if (hit) return hit;
  const briefing = await cityBriefing(id);
  if (lang === "en") {
    const en: CityTranslation = {
      lang,
      headline: briefing.article.headline,
      dek: briefing.article.dek,
      section: briefing.article.section,
      summary: briefing.summary_en,
      points: briefing.points,
      facts: briefing.facts,
    };
    translationCache.set(key, en);
    return en;
  }
  if (!config.grok.enabled) {
    const out = await fallbackBriefingTranslation(briefing, lang);
    translationCache.set(key, out);
    return out;
  }
  let data: {
    headline: string;
    dek: string | null;
    section: string | null;
    summary: string;
    points: string[];
    who: string | null;
    what: string | null;
    where: string | null;
    when: string | null;
  };
  try {
    ({ data } = await grokJson<{
    headline: string;
    dek: string | null;
    section: string | null;
    summary: string;
    points: string[];
    who: string | null;
    what: string | null;
    where: string | null;
    when: string | null;
  }>({
    system: `Translate this city-news brief into ${LANG_NAME[lang]}. Translate the headline and the blurb (dek), then the summary, key points, section, and who/what/where/when. Keep paragraph breaks. Keep names, numbers, dates, and The New York Times in the original form when that is clearer. Do not add facts.`,
    user: JSON.stringify({
      headline: briefing.article.headline,
      dek: briefing.article.dek,
      section: briefing.article.section,
      summary: briefing.summary_en,
      points: briefing.points,
      facts: briefing.facts,
    }),
    schemaName: "city_translation",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        headline: { type: "string" },
        dek: { type: ["string", "null"] },
        section: { type: ["string", "null"] },
        summary: { type: "string" },
        points: { type: "array", items: { type: "string" } },
        who: { type: ["string", "null"] },
        what: { type: ["string", "null"] },
        where: { type: ["string", "null"] },
        when: { type: ["string", "null"] },
      },
      required: ["headline", "dek", "section", "summary", "points", "who", "what", "where", "when"],
    },
    temperature: 0,
    reasoningEffort: "none",
    maxTokens: 900,
  }));
  } catch {
    const out = await fallbackBriefingTranslation(briefing, lang);
    translationCache.set(key, out);
    return out;
  }
  const out: CityTranslation = {
    lang,
    headline: data.headline.trim() || briefing.article.headline,
    dek: data.dek?.trim() || null,
    section: data.section?.trim() || briefing.article.section,
    summary: paragraphs(data.summary) || briefing.summary_en,
    points: (data.points ?? []).map((point) => point.replace(/\s+/g, " ").trim()).filter(Boolean),
    facts: {
      who: data.who?.trim() || null,
      what: data.what?.trim() || null,
      where: data.where?.trim() || null,
      when: data.when?.trim() || briefing.facts.when,
    },
  };
  if (!out.points.length) out.points = briefing.points;
  translationCache.set(key, out);
  return out;
}

async function fallbackBriefingTranslation(briefing: CityBriefing, lang: CityLang): Promise<CityTranslation> {
  const [headline, dek, section, summary, who, what, where, ...points] = await translateTexts(
    [
      briefing.article.headline,
      briefing.article.dek ?? "",
      briefing.article.section ?? "",
      briefing.summary_en,
      briefing.facts.who ?? "",
      briefing.facts.what ?? "",
      briefing.facts.where ?? "",
      ...briefing.points,
    ],
    lang,
  );
  return {
    lang,
    headline: headline || briefing.article.headline,
    dek: dek || null,
    section: section || briefing.article.section,
    summary: summary || briefing.summary_en,
    points: points.filter(Boolean),
    facts: {
      who: who || null,
      what: what || null,
      where: where || null,
      when: briefing.facts.when,
    },
  };
}

async function fallbackCityList(articles: CityArticle[], lang: CityLang): Promise<CityArticle[]> {
  const headlines = await translateTexts(
    articles.map((article) => article.headline),
    lang,
  );
  const deks = await translateTexts(
    articles.map((article) => article.dek ?? ""),
    lang,
  );
  const sections = await translateTexts(
    articles.map((article) => article.section ?? ""),
    lang,
  );
  return articles.map((article, i) => ({
    ...article,
    headline: headlines[i] || article.headline,
    dek: deks[i] || article.dek,
    section: sections[i] || article.section,
  }));
}

export async function translateCityList(articles: CityArticle[], language: string): Promise<CityArticle[]> {
  const lang = asLang(language);
  if (lang === "en" || !articles.length) return articles;
  const key = `${lang}:${articles.map((a) => a.id).join(",")}`;
  const hit = listCache.get(key);
  if (hit) return hit;
  const translated = await fallbackCityList(articles, lang);
  listCache.set(key, translated);
  return translated;
}

const audio = new Map<string, { status: "pending" | "ready" | "failed"; url: string | null; error: string | null }>();

function audioKey(id: string, lang: CityLang) {
  return `${id}:${lang}`;
}

function safePart(value: string) {
  return value.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 80);
}

export function cityAudioView(id: string, language: string) {
  const lang = asLang(language);
  const cur = audio.get(audioKey(id, lang));
  return {
    available: config.elevenlabs.enabled,
    language: lang,
    status: cur?.status ?? "none",
    url: cur?.url ?? null,
    error: cur?.error ?? null,
  };
}

export function cityAudioFile(id: string, language: string): string | null {
  const lang = asLang(language);
  const cur = audio.get(audioKey(id, lang));
  if (cur?.status !== "ready" || !cur.url) return null;
  const fp = path.join(config.audioDir, `city-${safePart(id)}-${lang}.mp3`);
  return fs.existsSync(fp) ? fp : null;
}

function spokenBrief(summary: string, points: string[]): string {
  const body = paragraphs(summary);
  if (!points.length) return body;
  return `${body}\n\n${points.join(" ")}`;
}

export async function requestCityAudio(id: string, language: string) {
  const lang = asLang(language);
  if (!config.elevenlabs.enabled) throw new HttpError(503, "Audio needs an ElevenLabs key. Add ELEVENLABS_API_KEY to .env and restart.");
  const key = audioKey(id, lang);
  const existing = audio.get(key);
  if (existing?.status === "ready") return cityAudioView(id, lang);
  if (existing?.status === "pending") return cityAudioView(id, lang);
  audio.set(key, { status: "pending", url: null, error: null });
  try {
    const spoken =
      lang === "en"
        ? await cityBriefing(id).then((brief) => spokenBrief(brief.summary_en, brief.points))
        : await translateBriefing(id, lang).then((brief) => spokenBrief(brief.summary, brief.points));
    const buf = await tts(spoken, lang === "zh" ? "zh" : lang);
    const fileId = `city-${safePart(id)}-${lang}`;
    saveFile(fileId, ".mp3", buf);
    audio.set(key, { status: "ready", url: `/media/city-audio/${encodeURIComponent(id)}/${lang}`, error: null });
  } catch (err) {
    audio.set(key, { status: "failed", url: null, error: (err as Error).message });
  }
  return cityAudioView(id, lang);
}

export { asLang };
