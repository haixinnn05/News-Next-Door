import type { ReactNode } from "react";

/**
 * Build a forgiving regex for a verbatim excerpt: whitespace-insensitive, tolerant of curly/straight
 * quotes and hyphen variants (including words hyphenated across line breaks). Case-insensitive.
 */
export function excerptRegex(excerpt: string): RegExp | null {
  const tokens = excerpt.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length || excerpt.trim().length < 3) return null;
  const tok = (t: string) =>
    t
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/['‘’‛′]/g, "['‘’‛′]")
      .replace(/["“”‟″]/g, '["“”‟″]')
      .replace(/[-‐‑‒–—―−]/g, "[-‐‑‒–—―−]\\s*");
  try {
    return new RegExp(tokens.map(tok).join("[\\s•·▪●*]+"), "gi");
  } catch {
    return null;
  }
}

export function excerptFound(excerpt: string, text: string | undefined): boolean {
  if (!text) return false;
  const re = excerptRegex(excerpt);
  return !!re && re.test(text);
}

/** Render `text` with every occurrence of the given excerpts wrapped in <mark>. */
export function Highlighted({ text, marks }: { text: string; marks: { excerpt: string; field: string }[] }) {
  const ranges: { start: number; end: number; fields: string[] }[] = [];
  for (const m of marks) {
    const re = excerptRegex(m.excerpt);
    if (!re) continue;
    let hit: RegExpExecArray | null;
    while ((hit = re.exec(text))) {
      if (!hit[0].length) {
        re.lastIndex++;
        continue;
      }
      ranges.push({ start: hit.index, end: hit.index + hit[0].length, fields: [m.field] });
    }
  }
  if (!ranges.length) return <>{text}</>;
  ranges.sort((a, b) => a.start - b.start || b.end - a.end);
  const merged: typeof ranges = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r.start <= last.end) {
      last.end = Math.max(last.end, r.end);
      for (const f of r.fields) if (!last.fields.includes(f)) last.fields.push(f);
    } else merged.push({ ...r, fields: [...r.fields] });
  }
  const out: ReactNode[] = [];
  let pos = 0;
  merged.forEach((r, i) => {
    if (r.start > pos) out.push(text.slice(pos, r.start));
    out.push(
      <mark key={i} className="adm-mark" title={`Cited for: ${r.fields.join(", ")}`}>
        {text.slice(r.start, r.end)}
      </mark>,
    );
    pos = r.end;
  });
  if (pos < text.length) out.push(text.slice(pos));
  return <>{out}</>;
}
