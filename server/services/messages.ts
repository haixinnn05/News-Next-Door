import { config } from "../config.ts";
import { formatDateOnly, formatNycDateTime } from "../lib/util.ts";
import type { EventRow, ProposalRow } from "./proposals.ts";

type Lang = "en" | "zh";

export const proposalUrl = (id: string, tab?: string) => `${config.publicBaseUrl}/p/${id}${tab ? `/${tab}` : ""}`;

function when(e: EventRow, lang: Lang): string {
  if (e.starts_at) return formatNycDateTime(e.starts_at, lang);
  if (e.date) return formatDateOnly(e.date, lang);
  return lang === "zh" ? "日期待定" : "date not announced";
}

function demoTag(p: ProposalRow, e?: EventRow | null): string {
  return p.is_sample || e?.is_demo ? "[DEMO — sample data, not a real meeting] " : "";
}

const title = (p: ProposalRow, lang: Lang) => (lang === "zh" && p.title_zh ? p.title_zh : p.title);

export function confirmationText(p: ProposalRow, next: EventRow | undefined, reminderFor: EventRow | undefined, sourceUrl: string | null, lang: Lang): string {
  const soon = next?.starts_at && !reminderFor && Date.parse(next.starts_at) - Date.now() < config.reminderLeadHours * 3600_000;
  const lines: string[] = [];
  if (lang === "zh") {
    lines.push(`${demoTag(p, next)}News Next Door：您已关注「${title(p, lang)}」。`);
    if (next) {
      lines.push(`下一步：${next.title}，${when(next, lang)}${next.location ? `，地点：${next.location}` : ""}。`);
      if (reminderFor) lines.push(`我们会在「${reminderFor.title}」（${when(reminderFor, lang)}）开始前 ${config.reminderLeadHours} 小时提醒您。`);
      else if (soon) lines.push("会议即将开始，以上即为会议信息。");
      else lines.push("如有更新，我们会通知您。");
    } else lines.push("官方文件尚未公布下一次会议。如有更新，我们会通知您。");
    lines.push(`详情和语音：${proposalUrl(p.id)}`);
    if (sourceUrl) lines.push(`原始文件：${sourceUrl}`);
    lines.push("回复 STOP 取消订阅。");
  } else {
    lines.push(`${demoTag(p, next)}News Next Door: You're following “${p.title}”.`);
    if (next) {
      lines.push(`Next: ${next.title} — ${when(next, lang)}${next.location ? `, ${next.location}` : ""}.`);
      if (reminderFor) lines.push(`We'll remind you ${config.reminderLeadHours} hours before the ${reminderFor.title.toLowerCase()} (${when(reminderFor, lang)}).`);
      else if (soon) lines.push("It's coming up soon, so here are the details now.");
      else lines.push("We'll text you if the details change.");
    } else lines.push("Next meeting not announced in the source documents. We'll text you if that changes.");
    lines.push(`Details & audio: ${proposalUrl(p.id)}`);
    if (sourceUrl) lines.push(`Source: ${sourceUrl}`);
    lines.push("Reply STOP to unsubscribe.");
  }
  return lines.join("\n");
}

export function reminderText(p: ProposalRow, e: EventRow, sourceUrl: string | null, lang: Lang): string {
  if (lang === "zh") {
    return [
      `${demoTag(p, e)}提醒（News Next Door）：「${title(p, lang)}」的${e.title}将于 ${when(e, lang)} 举行${e.location ? `，地点：${e.location}` : ""}。`,
      e.instructions ? `参与方式：${e.instructions}` : null,
      `详情：${proposalUrl(p.id, "participate")}`,
      sourceUrl ? `原始文件：${sourceUrl}` : null,
      "回复 STOP 取消订阅。",
    ].filter(Boolean).join("\n");
  }
  return [
    `${demoTag(p, e)}Reminder (News Next Door): ${e.title} for “${p.title}” — ${when(e, lang)}${e.location ? `, ${e.location}` : ""}.`,
    e.instructions ? `How to take part: ${e.instructions}` : null,
    `Details: ${proposalUrl(p.id, "participate")}`,
    sourceUrl ? `Source: ${sourceUrl}` : null,
    "Reply STOP to unsubscribe.",
  ].filter(Boolean).join("\n");
}

export function updateText(p: ProposalRow, changes: string[], sourceUrl: string | null, lang: Lang): string {
  if (lang === "zh") {
    return [`${demoTag(p)}更新（News Next Door）：「${title(p, lang)}」`, ...changes.map((c) => `• ${c}`), `详情：${proposalUrl(p.id, "timeline")}`, sourceUrl ? `原始文件：${sourceUrl}` : null, "回复 STOP 取消订阅。"]
      .filter(Boolean)
      .join("\n");
  }
  return [`${demoTag(p)}Update (News Next Door): “${p.title}”`, ...changes.map((c) => `• ${c}`), `Details: ${proposalUrl(p.id, "timeline")}`, sourceUrl ? `Source: ${sourceUrl}` : null, "Reply STOP to unsubscribe."]
    .filter(Boolean)
    .join("\n");
}

export const STOP_TEXT = "News Next Door: You're unsubscribed and won't get more messages. 您已取消订阅。To follow again, use Follow on any proposal page.";
export const HELP_TEXT =
  "News Next Door sends updates about Queens CB2 proposals you follow. To follow one, send the code shown on its page (like QCB2-1234). Reply STOP to unsubscribe. 发送页面上的代码即可关注；回复 STOP 取消订阅。";
export const EXPIRED_TEXT = "News Next Door: That code has expired or wasn't recognized. Open the proposal page and tap Follow to get a new code.";
