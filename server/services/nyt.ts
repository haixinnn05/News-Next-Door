/**
 * Citywide headlines from The New York Times.
 *
 * RSS (no key): N.Y. / Region feed listed in the NYT RSS API docs.
 * Article Search (optional NYT_API_KEY): recent Metro / New York City docs.
 *
 * The public feed keeps headline, blurb, date, section, and a link.
 * When a neighbor opens a story we also read the article page (or Grok browses it)
 * so key points come from the story, not only the RSS blurb. The full article is
 * never shown on our pages.
 */
import { load } from "cheerio";
import { config } from "../config.ts";
import { HttpError } from "../lib/util.ts";

const RSS_URL = "https://rss.nytimes.com/services/xml/rss/nyt/NYRegion.xml";
const RSS_PAGE = "https://www.nytimes.com/rss";
const SEARCH_URL = "https://api.nytimes.com/svc/search/v2/articlesearch.json";
const TTL_MS = 10 * 60 * 1000;
const UA = "NewsNextDoor/0.1 (civic neighborhood news; +https://github.com/jonathangu0/Before-The-Vote)";

export type CityTopic = "weather" | "politics" | "housing" | "transit" | "business" | "arts" | "crime" | "sports" | "schools" | "health" | "newyork";

export interface CityArticle {
  id: string;
  headline: string;
  dek: string | null;
  /** Official Times lead paragraph from Article Search, when available. */
  lead: string | null;
  keywords: string[];
  url: string;
  date: string | null;
  section: string | null;
  topic: CityTopic;
  source: "nyt-rss" | "nyt-search";
}

export interface CityNewsFeed {
  source: {
    name: string;
    rss_url: string;
    search: boolean;
    fetched_at: string;
  };
  articles: CityArticle[];
}

interface SearchDoc {
  _id?: string;
  web_url?: string;
  headline?: { main?: string };
  abstract?: string;
  snippet?: string;
  lead_paragraph?: string;
  keywords?: { name?: string; value?: string }[];
  pub_date?: string;
  section_name?: string;
  news_desk?: string;
}

function stripHtml(value: string): string {
  return load(`<div>${value}</div>`)
    .text()
    .replace(/\s+/g, " ")
    .replace(/\s*Continue reading the main story\.?/gi, "")
    .trim();
}

function day(value: string | null | undefined): string | null {
  if (!value) return null;
  const iso = Date.parse(value);
  if (Number.isFinite(iso)) return new Date(iso).toISOString().slice(0, 10);
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  return match ? match[1] : null;
}

export function articleId(url: string, fallback: string, date?: string | null): string {
  try {
    const parts = new URL(url).pathname.replace(/\/+$/, "").replace(/\.html$/i, "").split("/").filter(Boolean);
    const slug = (parts.at(-1) ?? "").slice(0, 60);
    const yearAt = parts.findIndex((part, i) => /^\d{4}$/.test(part) && /^\d{2}$/.test(parts[i + 1] ?? "") && /^\d{2}$/.test(parts[i + 2] ?? ""));
    const stamp = yearAt >= 0 ? `${parts[yearAt]}${parts[yearAt + 1]}${parts[yearAt + 2]}` : (date ?? "").replace(/-/g, "");
    const id = [stamp, slug || fallback.replace(/[^A-Za-z0-9_-]/g, "")].filter(Boolean).join("-");
    if (id) return id.slice(0, 90);
  } catch {
    /* keep fallback */
  }
  return `${(date ?? "").replace(/-/g, "")}-${fallback.replace(/[^A-Za-z0-9_-]/g, "")}`.replace(/^-/, "").slice(0, 90) || "nyt";
}

function canonUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.search = "";
    parsed.hostname = parsed.hostname.replace(/^www\./, "");
    return parsed.toString();
  } catch {
    return url.split("#")[0].split("?")[0];
  }
}

function deskOfUrl(url: string): string {
  try {
    const parts = new URL(url).pathname.toLowerCase().split("/").filter(Boolean);
    const skip = new Set(["live", "interactive"]);
    for (const part of parts) {
      if (/^\d{2,4}$/.test(part) || skip.has(part)) continue;
      return part;
    }
  } catch {
    /* ignore */
  }
  return "";
}

/** Label from the Times path, headline, and section — not “buildings” for every metro story. */
export function topicOfArticle(input: { url: string; headline: string; dek?: string | null; section?: string | null }): CityTopic {
  const desk = deskOfUrl(input.url);
  const path = (() => {
    try {
      return new URL(input.url).pathname;
    } catch {
      return input.url;
    }
  })();
  const blob = `${path} ${desk} ${input.headline} ${input.dek ?? ""} ${input.section ?? ""}`.toLowerCase();
  if (desk === "weather" || /nor.?easter|hurricane|storm|flood|blizzard|snow|\bweather\b/.test(blob)) return "weather";
  if (desk === "realestate" || /real estate|housing|rent|rezoning/.test(blob)) return "housing";
  if (desk === "business" || /business|company|market/.test(blob)) return "business";
  if (desk === "sports" || /\bsport/.test(blob)) return "sports";
  if (desk === "health" || /\bhealth|hospital|medical/.test(blob)) return "health";
  if (desk === "education" || /school|student|teacher|classroom/.test(blob)) return "schools";
  if (desk === "arts" || desk === "music" || desk === "theater" || /concert|festival|feast|theater|music|art show/.test(blob)) return "arts";
  if (/subway|mta|\bbus\b|transit|flight|airport/.test(blob)) return "transit";
  if (/arrest|police|crime|shooting|sewer/.test(blob)) return "crime";
  if (/mayor|democrat|republican|election|council|politic|mamdani|city hall|united nations|\bun\b/.test(blob)) return "politics";
  return "newyork";
}

const SECTION_HINT = /new york|n\.y|region|metro|real estate|housing|transit|transport|sport|art|food|travel|politics|weather/i;

function sectionOf(categories: string[]): string {
  const clean = categories.map((c) => c.trim()).filter(Boolean);
  return clean.find((c) => /n\.y|new york city|nyregion|metro/i.test(c)) ?? clean.find((c) => SECTION_HINT.test(c)) ?? "N.Y. / Region";
}

export function parseRss(xml: string): CityArticle[] {
  const $ = load(xml, { xml: true });
  const items: CityArticle[] = [];
  $("item").each((_, el) => {
    const node = $(el);
    const headline = stripHtml(node.find("title").first().text());
    const url = (node.find("link").first().text() || node.find("guid").first().text()).trim();
    if (!headline || !url) return;
    const section = sectionOf(node.find("category").map((_, cat) => $(cat).text()).get());
    const dek = stripHtml(node.find("description").first().text()) || null;
    const date = day(node.find("pubDate").first().text());
    items.push({
      id: articleId(url, headline, date),
      headline,
      dek: dek && dek !== headline ? dek : null,
      lead: null,
      keywords: [],
      url,
      date,
      section,
      topic: topicOfArticle({ url, headline, dek, section }),
      source: "nyt-rss",
    });
  });
  return items;
}

export function parseSearchDocs(docs: SearchDoc[]): CityArticle[] {
  return docs.flatMap((doc) => {
    const headline = doc.headline?.main?.trim();
    const url = doc.web_url?.trim();
    if (!headline || !url) return [];
    const section = doc.section_name?.trim() || doc.news_desk?.trim() || "New York";
    const dek = (doc.abstract || doc.snippet || "").trim() || null;
    const lead = (doc.lead_paragraph || "").trim() || null;
    const keywords = (doc.keywords ?? []).map((item) => item.value?.trim()).filter((value): value is string => !!value);
    const date = day(doc.pub_date);
    return [
      {
        id: articleId(url, doc._id ?? headline, date),
        headline,
        dek: dek && dek !== headline ? dek : lead && lead !== headline ? lead : null,
        lead: lead && lead !== headline ? lead : null,
        keywords,
        url,
        date,
        section,
        topic: topicOfArticle({ url, headline, dek: dek ?? lead, section }),
        source: "nyt-search" as const,
      },
    ];
  });
}

function fillArticle(prev: CityArticle, next: CityArticle): CityArticle {
  return {
    ...prev,
    dek: prev.dek || next.dek,
    lead: prev.lead || next.lead,
    keywords: prev.keywords.length ? prev.keywords : next.keywords,
    section: prev.section || next.section,
  };
}

export function mergeArticles(groups: CityArticle[][]): CityArticle[] {
  const seen = new Map<string, number>();
  const out: CityArticle[] = [];
  for (const group of groups) {
    for (const article of group) {
      const key = canonUrl(article.url);
      const at = seen.get(key);
      if (at === undefined) {
        seen.set(key, out.length);
        out.push(article);
        continue;
      }
      out[at] = fillArticle(out[at], article);
    }
  }
  out.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || a.headline.localeCompare(b.headline));
  return out.slice(0, 30);
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { Accept: "application/rss+xml, application/xml, text/xml, */*", "User-Agent": UA },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`NYT RSS returned ${res.status}`);
  return res.text();
}

async function fetchSearch(apiKey: string): Promise<CityArticle[]> {
  const url = new URL(SEARCH_URL);
  url.searchParams.set("fq", 'news_desk:("Metro") OR section_name:("New York") OR glocations:("NEW YORK CITY")');
  url.searchParams.set("sort", "newest");
  url.searchParams.set("page", "0");
  url.searchParams.set("fl", "web_url,headline,abstract,snippet,lead_paragraph,keywords,pub_date,section_name,news_desk,_id");
  url.searchParams.set("api-key", apiKey);
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": UA },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`NYT Article Search returned ${res.status}`);
  const body = (await res.json()) as { status?: string; response?: { docs?: SearchDoc[] } };
  if (body.status && body.status !== "OK") throw new Error(`NYT Article Search status ${body.status}`);
  return parseSearchDocs(body.response?.docs ?? []);
}

let cache: { at: number; body: CityNewsFeed } | null = null;
const byId = new Map<string, CityArticle>();

function index(body: CityNewsFeed) {
  byId.clear();
  for (const article of body.articles) byId.set(article.id, article);
}

export async function articleById(id: string): Promise<CityArticle> {
  if (!byId.has(id)) await cityNews();
  const article = byId.get(id);
  if (!article) throw new HttpError(404, "Story not found");
  return article;
}

const lookupCache = new Map<string, CityArticle | null>();

function nytLookupUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.search = "";
    if (!parsed.hostname.startsWith("www.")) parsed.hostname = `www.${parsed.hostname}`;
    return parsed.toString();
  } catch {
    return url.split("#")[0].split("?")[0];
  }
}

async function searchDocByUrl(url: string): Promise<CityArticle | null> {
  if (!config.nyt.apiKey) return null;
  const key = canonUrl(url);
  if (lookupCache.has(key)) return lookupCache.get(key) ?? null;
  const api = new URL(SEARCH_URL);
  api.searchParams.set("fq", `web_url:("${nytLookupUrl(url)}")`);
  api.searchParams.set("fl", "web_url,headline,abstract,snippet,lead_paragraph,keywords,pub_date,section_name,news_desk,_id");
  api.searchParams.set("api-key", config.nyt.apiKey);
  try {
    const res = await fetch(api, {
      headers: { Accept: "application/json", "User-Agent": UA },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) {
      lookupCache.set(key, null);
      return null;
    }
    const body = (await res.json()) as { status?: string; response?: { docs?: SearchDoc[] } };
    const match = parseSearchDocs(body.response?.docs ?? []).find((doc) => canonUrl(doc.url) === key) ?? parseSearchDocs(body.response?.docs ?? [])[0] ?? null;
    lookupCache.set(key, match);
    return match;
  } catch {
    lookupCache.set(key, null);
    return null;
  }
}

/** Add the official lead paragraph and keywords when Article Search has them. */
export async function enrichArticle(article: CityArticle): Promise<CityArticle> {
  if (article.lead && article.keywords.length) return article;
  const extra = await searchDocByUrl(article.url);
  if (!extra) return article;
  return fillArticle(article, extra);
}

const SKIP_LINE = /^(advertisement|supported by|subscribe|continue reading|sign up|the new york times|credit|photo)$/i;

function cleanPara(text: string): string | null {
  const value = text.replace(/\s+/g, " ").replace(/\s*Continue reading the main story\.?/gi, "").trim();
  if (value.length < 40 || SKIP_LINE.test(value)) return null;
  return value;
}

function parasFromJsonLd(html: string): string[] {
  const $ = load(html);
  const out: string[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const raw = JSON.parse($(el).text());
      const nodes = Array.isArray(raw) ? raw : [raw, ...(Array.isArray(raw["@graph"]) ? raw["@graph"] : [])];
      for (const node of nodes) {
        const body = typeof node?.articleBody === "string" ? node.articleBody : "";
        if (!body) continue;
        for (const chunk of body.split(/\n+|(?<=[.!?])\s+(?=[A-Z])/)) {
          const para = cleanPara(chunk);
          if (para) out.push(para);
        }
      }
    } catch {
      /* ignore bad json-ld */
    }
  });
  return out;
}

/** Pull story paragraphs from a Times article page. Used only to write a brief. */
export function extractArticleBody(html: string): string[] {
  if (looksLikeChallenge(html)) return [];
  const fromLd = parasFromJsonLd(html);
  const $ = load(html);
  const nodes = $('[data-testid="paragraph"], section[name="articleBody"] p, .StoryBodyCompanionColumn p, [data-testid="live-blog-post"] p, article p').toArray();
  const fromDom: string[] = [];
  for (const node of nodes) {
    const para = cleanPara($(node).text());
    if (para) fromDom.push(para);
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const para of (fromDom.length >= 3 ? fromDom : [...fromDom, ...fromLd])) {
    const key = para.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(para);
    if (out.length >= 40) break;
  }
  return out;
}

function looksLikeChallenge(html: string): boolean {
  if (/data-testid="paragraph"|name="articleBody"|articleBody/i.test(html)) return false;
  return html.length < 2000 || /#cmsg|pardon our interruption|access denied|just a moment/i.test(html);
}

const bodyCache = new Map<string, string[]>();

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Referer: "https://www.nytimes.com/",
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/** Story paragraphs from the article page. Empty when the Times blocks the fetch. */
export async function fetchArticleBody(url: string): Promise<string[]> {
  const key = canonUrl(url);
  if (bodyCache.has(key)) return bodyCache.get(key) ?? [];
  const html = await fetchHtml(nytLookupUrl(url));
  const paras = html ? extractArticleBody(html) : [];
  bodyCache.set(key, paras);
  return paras;
}

export async function cityNews(now = Date.now()): Promise<CityNewsFeed> {
  if (cache && now - cache.at < TTL_MS) {
    if (!byId.size) index(cache.body);
    return cache.body;
  }
  const rss = fetchText(RSS_URL).then(parseRss);
  const search = config.nyt.apiKey ? fetchSearch(config.nyt.apiKey) : Promise.resolve([]);
  const settled = await Promise.allSettled([rss, search]);
  const rssArticles = settled[0].status === "fulfilled" ? settled[0].value : [];
  const searchArticles = settled[1].status === "fulfilled" ? settled[1].value : [];
  if (!rssArticles.length && !searchArticles.length) {
    const reason = settled.map((r) => (r.status === "rejected" ? r.reason : null)).find(Boolean);
    throw new HttpError(502, reason instanceof Error ? reason.message : "Could not load city news.");
  }
  const body: CityNewsFeed = {
    source: {
      name: "The New York Times",
      rss_url: RSS_PAGE,
      search: searchArticles.length > 0,
      fetched_at: new Date(now).toISOString(),
    },
    articles: mergeArticles([searchArticles, rssArticles]),
  };
  cache = { at: now, body };
  index(body);
  return body;
}
