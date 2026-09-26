export const nowIso = () => new Date().toISOString();

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 14)}`;
}

export const NYC_TZ = "America/New_York";

/** Offset (ms) of America/New_York from UTC at the given instant. */
function nycOffsetMs(at: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: NYC_TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(at));
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second"));
  return asUtc - at;
}

/** Convert an NYC wall-clock date/time to a UTC ISO string (DST-aware). */
export function nycToUtcIso(date: string, time: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  let guess = wall - nycOffsetMs(wall);
  guess = wall - nycOffsetMs(guess);
  return new Date(guess).toISOString();
}

/** NYC calendar date (YYYY-MM-DD) for an instant. */
export function nycDate(at: Date | string | number = Date.now()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: NYC_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(at));
}

export function formatNycDateTime(iso: string, lang: "en" | "zh" = "en"): string {
  const d = new Date(iso);
  if (lang === "zh") {
    return new Intl.DateTimeFormat("zh-CN", { timeZone: NYC_TZ, month: "long", day: "numeric", weekday: "short", hour: "numeric", minute: "2-digit" }).format(d) + "（纽约时间）";
  }
  return new Intl.DateTimeFormat("en-US", { timeZone: NYC_TZ, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(d);
}

export function formatDateOnly(date: string, lang: "en" | "zh" = "en"): string {
  const d = new Date(`${date}T12:00:00Z`);
  return new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-US", { timeZone: "UTC", month: lang === "zh" ? "long" : "short", day: "numeric", year: "numeric" }).format(d);
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
