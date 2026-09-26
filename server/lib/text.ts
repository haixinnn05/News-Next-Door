/** Normalise text so an excerpt can be located in extracted PDF/HTML text despite whitespace/quote differences. */
export function normalizeForMatch(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/(\w)-[ \t]*\r?\n[ \t]*(\w)/g, "$1-$2") // re-join words hyphenated across line breaks
    .replace(/[‘’‛′]/g, "'")
    .replace(/[“”‟″]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/[•·▪●]/g, " ")
    .replace(/\*+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Letter-spaced headings ("T H E  S I T E") are common in presentation PDFs; collapse them for matching. */
function collapseLetterSpacing(s: string): string {
  return s.replace(/\b(?:\w ){3,}\w\b/g, (m) => m.replace(/ /g, ""));
}

export function excerptAppearsIn(excerpt: string, pageText: string): boolean {
  const e = normalizeForMatch(excerpt);
  if (e.length < 3) return false;
  const p = normalizeForMatch(pageText);
  if (p.includes(e)) return true;
  return collapseLetterSpacing(p).includes(collapseLetterSpacing(e));
}

export function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}
