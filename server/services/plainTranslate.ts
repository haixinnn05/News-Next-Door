/** Key-free line translation for city headlines and blurbs when Grok is off. */
const TARGET: Record<string, string> = {
  zh: "zh-CN",
  es: "es",
  fr: "fr",
  ja: "ja",
  hi: "hi",
  ar: "ar",
  ru: "ru",
};

export function parseGtx(body: unknown): string {
  if (!Array.isArray(body) || !Array.isArray(body[0])) return "";
  return (body[0] as unknown[])
    .map((row) => (Array.isArray(row) && typeof row[0] === "string" ? row[0] : ""))
    .join("")
    .trim();
}

async function translateOne(text: string, target: string): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return text;
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", "en");
  url.searchParams.set("tl", target);
  url.searchParams.set("dt", "t");
  url.searchParams.set("q", trimmed.slice(0, 1800));
  const res = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(12_000) });
  if (!res.ok) return text;
  const translated = parseGtx(await res.json());
  return translated || text;
}

export async function translateTexts(texts: string[], language: string): Promise<string[]> {
  const target = TARGET[language];
  if (!target || !texts.length) return texts;
  const unique = [...new Set(texts.filter((text) => text.trim()))];
  const map = new Map<string, string>();
  for (let i = 0; i < unique.length; i += 5) {
    const batch = unique.slice(i, i + 5);
    const done = await Promise.all(
      batch.map(async (text) => {
        try {
          return [text, await translateOne(text, target)] as const;
        } catch {
          return [text, text] as const;
        }
      }),
    );
    for (const [from, to] of done) map.set(from, to);
  }
  return texts.map((text) => map.get(text) ?? text);
}
