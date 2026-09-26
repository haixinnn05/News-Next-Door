import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";
import { extractText, getDocumentProxy } from "unpdf";
import { config } from "../config.ts";
import { all, get, run, tx, type Db } from "../db.ts";
import { HttpError, newId, nowIso } from "../lib/util.ts";

export interface DocumentRow {
  id: string;
  board: string;
  official_url: string;
  title: string;
  publication_date: string | null;
  retrieved_at: string;
  content_hash: string;
  mime_type: string;
  file_path: string;
  page_count: number;
  is_sample: number;
  created_at: string;
}

export interface Page {
  page: number;
  text: string;
}

const MAX_BYTES = 40 * 1024 * 1024;

export function detectKind(bytes: Uint8Array, filename: string, mime?: string): "pdf" | "html" {
  const head = Buffer.from(bytes.slice(0, 5)).toString("latin1");
  if (head.startsWith("%PDF")) return "pdf";
  if (mime?.includes("html") || /\.html?$/i.test(filename)) return "html";
  const sniff = Buffer.from(bytes.slice(0, 512)).toString("utf8").toLowerCase();
  if (sniff.includes("<html") || sniff.includes("<!doctype html")) return "html";
  throw new HttpError(415, "Only text-based PDF and HTML files are supported.");
}

export async function parsePdf(bytes: Uint8Array): Promise<Page[]> {
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { text } = await extractText(pdf, { mergePages: false });
  return text.map((t, i) => ({ page: i + 1, text: t.replace(/[ \t]+\n/g, "\n").trim() }));
}

/** HTML: strip chrome, then split into sections at h1–h3 so evidence can cite "section N". */
export function parseHtml(html: string): { title: string | null; pages: Page[] } {
  const $ = cheerio.load(html);
  $("script,style,noscript,nav,header,footer,iframe,svg,form").remove();
  const title = $("title").first().text().trim() || $("h1").first().text().trim() || null;
  const root = $("main").length ? $("main").first() : $("body");
  const sections: string[] = [];
  let current: string[] = [];
  root.find("h1,h2,h3,p,li,td,th,dd,dt,blockquote,pre").each((_, el) => {
    const tag = (el as { tagName?: string }).tagName?.toLowerCase();
    const t = $(el).text().replace(/\s+/g, " ").trim();
    if (!t) return;
    if ((tag === "h1" || tag === "h2" || tag === "h3") && current.length) {
      sections.push(current.join("\n"));
      current = [];
    }
    current.push(t);
  });
  if (current.length) sections.push(current.join("\n"));
  if (!sections.length) {
    const t = root.text().replace(/\s+/g, " ").trim();
    if (t) sections.push(t);
  }
  return { title, pages: sections.map((text, i) => ({ page: i + 1, text })) };
}

export interface ImportInput {
  bytes: Uint8Array;
  filename: string;
  mimeType?: string;
  officialUrl: string;
  publicationDate?: string | null;
  title?: string | null;
  isSample?: boolean;
}

export interface ImportResult {
  document: DocumentRow;
  duplicate: boolean;
}

export async function importDocument(db: Db, input: ImportInput): Promise<ImportResult> {
  if (input.bytes.byteLength === 0) throw new HttpError(400, "The file is empty.");
  if (input.bytes.byteLength > MAX_BYTES) throw new HttpError(413, "File is larger than 40 MB.");
  let url: URL;
  try {
    url = new URL(input.officialUrl);
    if (!/^https?:$/.test(url.protocol)) throw new Error();
  } catch {
    throw new HttpError(400, "Enter the official source URL (http/https) for this document.");
  }
  if (input.publicationDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.publicationDate)) throw new HttpError(400, "Publication date must be YYYY-MM-DD.");

  const hash = crypto.createHash("sha256").update(input.bytes).digest("hex");
  const existing = get<DocumentRow>(db, "SELECT * FROM documents WHERE content_hash = ?", hash);
  if (existing) return { document: existing, duplicate: true };

  const kind = detectKind(input.bytes, input.filename, input.mimeType);
  let pages: Page[];
  let parsedTitle: string | null = null;
  if (kind === "pdf") {
    try {
      pages = await parsePdf(input.bytes);
    } catch (e) {
      throw new HttpError(422, `Could not read this PDF: ${(e as Error).message}`);
    }
  } else {
    const parsed = parseHtml(Buffer.from(input.bytes).toString("utf8"));
    pages = parsed.pages;
    parsedTitle = parsed.title;
  }
  const chars = pages.reduce((n, p) => n + p.text.replace(/\s/g, "").length, 0);
  if (chars < 80) throw new HttpError(422, "No readable text found. Scanned documents are not supported in this demo — use a text-based PDF or HTML page.");

  const id = newId("doc");
  const ext = kind === "pdf" ? ".pdf" : ".html";
  fs.mkdirSync(config.uploadsDir, { recursive: true });
  const filePath = path.join(config.uploadsDir, `${id}${ext}`);
  fs.writeFileSync(filePath, input.bytes);

  const title = (input.title?.trim() || parsedTitle || input.filename.replace(/\.(pdf|html?)$/i, "").replace(/[-_]+/g, " ")).slice(0, 200);
  const now = nowIso();
  tx(db, () => {
    run(
      db,
      `INSERT INTO documents (id, official_url, title, publication_date, retrieved_at, content_hash, mime_type, file_path, page_count, is_sample, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      id, url.toString(), title, input.publicationDate ?? null, now, hash, kind === "pdf" ? "application/pdf" : "text/html", filePath, pages.length, input.isSample ? 1 : 0, now,
    );
    const ins = db.prepare("INSERT INTO document_pages (document_id, page, text) VALUES (?,?,?)");
    for (const p of pages) ins.run(id, p.page, p.text);
  });
  return { document: get<DocumentRow>(db, "SELECT * FROM documents WHERE id = ?", id)!, duplicate: false };
}

export function getPages(db: Db, documentId: string): Page[] {
  return all<Page>(db, "SELECT page, text FROM document_pages WHERE document_id = ? ORDER BY page", documentId);
}

export function getDocument(db: Db, id: string): DocumentRow | undefined {
  return get<DocumentRow>(db, "SELECT * FROM documents WHERE id = ?", id);
}

/** Fetch a document from an official URL (team-only). */
export async function fetchRemote(url: string): Promise<{ bytes: Uint8Array; mimeType: string; filename: string }> {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (BeforeTheVote document importer)" }, redirect: "follow" });
  if (!res.ok) throw new HttpError(502, `Source returned HTTP ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  return { bytes, mimeType: res.headers.get("content-type") ?? "", filename: decodeURIComponent(new URL(url).pathname.split("/").pop() || "document") };
}
