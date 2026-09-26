import { fmtDateLong, titleOf } from "./format";
import type { Lang } from "./i18n";
import type { CityArticle, ProposalCard, ZapApplication } from "./types";
import { zhCivic } from "./zhCivic";

export type AppTopic = "housing" | "parks" | "buildings";
export type Topic = AppTopic | "buses" | "city" | "weather" | "politics" | "transit" | "business" | "arts" | "crime" | "sports" | "schools" | "health" | "newyork";

export interface Story {
  id: string;
  href: string;
  headline: string;
  date: string | null;
  topic: Topic;
  location: string | null;
  sourceUrl: string | null;
  dek?: string | null;
  kicker?: string | null;
  external?: boolean;
}

export function streetOf(label: string | null | undefined): string | null {
  if (!label) return null;
  const street = label.split("·")[0].replace(/\s+/g, " ").trim();
  return street || null;
}

export function topicOfApp(a: ZapApplication): AppTopic {
  const blob = `${a.name} ${a.brief ?? ""} ${a.actions.map((action) => action.label).join(" ")}`;
  if (/park|open space|site selection/i.test(blob)) return "parks";
  if (/apartment|housing|residential|mixed-use|\bMIH\b|dwelling/i.test(blob)) return "housing";
  return "buildings";
}

export function headlineOfApp(a: ZapApplication, lang: Lang): string {
  return zhCivic(a.name, lang);
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

function cityPlace(section: string | null): string | null {
  if (!section) return "New York";
  if (/n\.y|new york|nyregion|metro|region/i.test(section)) return "New York";
  return section;
}

export function storyFromCity(a: CityArticle): Story {
  return {
    id: a.id,
    href: `/c/${encodeURIComponent(a.id)}`,
    headline: a.headline,
    date: a.date,
    topic: a.topic,
    location: cityPlace(a.section),
    sourceUrl: a.url,
    dek: a.dek,
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
