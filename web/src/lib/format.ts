import type { Lang } from "./i18n";
import type { ProposalCard, PublicEvent } from "./types";

const TZ = "America/New_York";

export function fmtDate(date: string, lang: Lang = "en"): string {
  return new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-US", { timeZone: "UTC", month: lang === "zh" ? "long" : "short", day: "numeric", year: "numeric" }).format(new Date(`${date}T12:00:00Z`));
}
export function fmtTime(iso: string, lang: Lang = "en"): string {
  return new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}
export function fmtEventWhen(e: PublicEvent, lang: Lang = "en"): string | null {
  if (!e.date) return null;
  const d = fmtDate(e.date, lang);
  return e.starts_at ? `${d} · ${fmtTime(e.starts_at, lang)}` : d;
}
export function fmtDateTimeShort(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}
export function fmtRelative(iso: string): string {
  const diff = Date.parse(iso) - Date.now();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < 60_000) return rtf.format(Math.round(diff / 1000), "second");
  if (abs < 3_600_000) return rtf.format(Math.round(diff / 60_000), "minute");
  if (abs < 86_400_000) return rtf.format(Math.round(diff / 3_600_000), "hour");
  return rtf.format(Math.round(diff / 86_400_000), "day");
}

const TYPE_LABEL: Record<string, [string, string]> = {
  application_filed: ["Application filed", "申请已提交"],
  community_discussion: ["Community Discussion", "社区讨论"],
  committee_meeting: ["Committee Meeting", "委员会会议"],
  public_hearing: ["Public Hearing", "公开听证会"],
  board_meeting: ["Board Meeting", "全体委员会会议"],
  comment_deadline: ["Comment Deadline", "意见截止"],
  board_review: ["Board Review", "委员会审议"],
  decision: ["Decision", "决定"],
  other: ["Milestone", "里程碑"],
};
export const eventTypeLabel = (t: string, lang: Lang = "en") => (TYPE_LABEL[t] ?? TYPE_LABEL.other)[lang === "zh" ? 1 : 0];

const STAGE_LABEL: Record<string, [string, string]> = {
  application_filed: ["Application Filed", "申请已提交"],
  community_discussion: ["Community Discussion", "社区讨论"],
  public_hearing: ["Public Hearing", "公开听证会"],
  review_in_progress: ["Review in Progress", "审议中"],
  decided: ["Decided", "已决定"],
  withdrawn: ["Withdrawn", "已撤回"],
  unknown: ["Stage not listed", "阶段未列出"],
};
export const stageLabel = (kind: string, lang: Lang = "en") => (STAGE_LABEL[kind] ?? STAGE_LABEL.unknown)[lang === "zh" ? 1 : 0];

/** Card status line, e.g. "Public Hearing · Oct 14, 2026". Prefers the upcoming event that matches the stage. */
export function cardStatus(p: ProposalCard, lang: Lang = "en"): { label: string; date: string | null } {
  const e = p.next_event;
  if (e?.date) return { label: eventTypeLabel(e.type, lang), date: fmtDate(e.date, lang) };
  return { label: stageLabel(p.stage_kind, lang), date: null };
}

export const titleOf = (p: { title: string; title_zh: string | null }, lang: Lang) => (lang === "zh" && p.title_zh ? p.title_zh : p.title);
export const summaryOf = (p: { summary: string; summary_zh: string | null }, lang: Lang) => (lang === "zh" && p.summary_zh ? p.summary_zh : p.summary);

export function fmtDuration(s: number): string {
  if (!isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}
