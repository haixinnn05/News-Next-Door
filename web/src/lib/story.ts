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
  if (topicOfApp(a) === "parks") {
    if (!street) return lang === "zh" ? "附近的一座公园" : "A park nearby";
    return lang === "zh" ? `${street} 的公园` : `A park at ${street}`;
  }
  if (street) return lang === "zh" ? `${street} 的建房计划` : `A building plan at ${street}`;
  return a.name;
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
