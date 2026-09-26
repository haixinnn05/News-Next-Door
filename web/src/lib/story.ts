import { fmtDateLong, titleOf } from "./format";
import type { Lang } from "./i18n";
import type { ProposalCard, ZapApplication } from "./types";

export type Topic = "housing" | "parks" | "buildings" | "buses";

export interface Story {
  id: string;
  href: string;
  headline: string;
  date: string | null;
  topic: Topic;
  location: string | null;
  sourceUrl: string | null;
}

export function streetOf(label: string | null | undefined): string | null {
  if (!label) return null;
  const street = label.split("·")[0].replace(/\s+/g, " ").trim();
  return street || null;
}

export function topicOfApp(a: ZapApplication): Topic {
  const blob = `${a.name} ${a.brief ?? ""}`;
  if (/park/i.test(blob)) return "parks";
  if (/apartment|housing|residential|mixed-use|\bMIH\b/i.test(blob)) return "housing";
  return "buildings";
}

export function headlineOfApp(a: ZapApplication, lang: Lang): string {
  const street = streetOf(a.location?.label);
  const park = topicOfApp(a) === "parks";
  if (park && !street) {
    const nearby: Record<Lang, string> = {
      en: "A park nearby",
      zh: "附近的一座公园",
      es: "Un parque cerca",
      fr: "Un parc tout près",
      ja: "近くの公園",
      hi: "पास का एक पार्क",
      ar: "حديقة قريبة",
      ru: "Парк рядом",
    };
    return nearby[lang];
  }
  if (!street) return a.name;
  const line: Record<Lang, (place: string) => string> = park
    ? {
        en: (place) => `A park at ${place}`,
        zh: (place) => `${place} 的公园`,
        es: (place) => `Un parque en ${place}`,
        fr: (place) => `Un parc à ${place}`,
        ja: (place) => `${place}の公園`,
        hi: (place) => `${place} पर एक पार्क`,
        ar: (place) => `حديقة في ${place}`,
        ru: (place) => `Парк на ${place}`,
      }
    : {
        en: (place) => `A building plan at ${place}`,
        zh: (place) => `${place} 的建房计划`,
        es: (place) => `Un plan de construcción en ${place}`,
        fr: (place) => `Un projet de bâtiment à ${place}`,
        ja: (place) => `${place}の建設計画`,
        hi: (place) => `${place} पर एक निर्माण योजना`,
        ar: (place) => `خطة بناء في ${place}`,
        ru: (place) => `План строительства на ${place}`,
      };
  return line[lang](street);
}

export function storyFromApp(a: ZapApplication, lang: Lang): Story {
  return {
    id: a.id,
    href: `/a/${encodeURIComponent(a.id)}`,
    headline: headlineOfApp(a, lang),
    date: a.milestone_date ?? a.certified_date ?? a.noticed_date ?? a.filed_date,
    topic: topicOfApp(a),
    location: streetOf(a.location?.label),
    sourceUrl: a.zap_url,
  };
}

export function storyFromProposal(p: ProposalCard, lang: Lang): Story {
  const topic: Topic = p.category === "parks_environment" ? "parks" : p.category === "transportation" ? "buses" : p.category === "land_use" ? "housing" : "buildings";
  return {
    id: p.id,
    href: `/p/${p.id}`,
    headline: titleOf(p, lang),
    date: p.next_event?.date ?? p.last_checked_at.slice(0, 10),
    topic,
    location: streetOf(p.address?.full ?? p.location_text),
    sourceUrl: null,
  };
}

export function storyDate(date: string | null, lang: Lang): string | null {
  return date ? fmtDateLong(date, lang) : null;
}
