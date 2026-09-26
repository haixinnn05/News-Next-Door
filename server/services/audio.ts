import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { config } from "../config.ts";
import { all, get, run, type Db } from "../db.ts";
import { wordCount } from "../lib/text.ts";
import { formatDateOnly, formatNycDateTime, HttpError, newId, nowIso } from "../lib/util.ts";
import { parseJsonReply } from "./extraction.ts";
import { translateScriptToChinese } from "./grok.ts";
import { getAudioRows, getEvents, getProposal, nextEvent, type AudioRow, type ProposalRow } from "./proposals.ts";

const XI = "https://api.elevenlabs.io/v1";

function xiHeaders(extra: Record<string, string> = {}) {
  if (!config.elevenlabs.enabled) throw new HttpError(503, "ELEVENLABS_API_KEY is not configured.");
  return { "xi-api-key": config.elevenlabs.apiKey, ...extra };
}

async function xiError(res: Response): Promise<string> {
  const t = await res.text().catch(() => "");
  try {
    const j = JSON.parse(t);
    return typeof j.detail === "string" ? j.detail : j.detail?.message ?? JSON.stringify(j.detail ?? j).slice(0, 300);
  } catch {
    return t.slice(0, 300) || res.statusText;
  }
}

/** Draft a 60–90 word spoken script from the approved card only (no new facts). */
export function draftScript(db: Db, p: ProposalRow): string {
  const next = nextEvent(getEvents(db, p.id));
  const parts: string[] = [];
  parts.push(`${p.title}.`);
  parts.push(p.summary.trim().replace(/\s+/g, " "));
  if (p.stage) parts.push(`Current stage, according to the source: ${p.stage.replace(/\.$/, "")}.`);
  if (next) {
    const when = next.starts_at ? formatNycDateTime(next.starts_at) : next.date ? formatDateOnly(next.date) : "";
    parts.push(`Next: ${next.title}${when ? `, ${when}` : ""}${next.location ? `, at ${next.location}` : ""}.${next.is_demo || p.is_sample ? " This is a sample demo event." : ""}`);
  } else {
    parts.push("No upcoming meeting date is listed in the source documents yet.");
  }
  parts.push("The official document is linked on this page.");
  return parts.join(" ");
}

function audioRow(db: Db, p: ProposalRow, lang: "en" | "zh"): AudioRow | undefined {
  return getAudioRows(db, p.id, p.version).find((a) => a.language === lang);
}

function ensureRow(db: Db, p: ProposalRow, lang: "en" | "zh"): AudioRow {
  const ex = audioRow(db, p, lang);
  if (ex) return ex;
  const now = nowIso();
  run(
    db,
    "INSERT INTO audio (id, proposal_id, proposal_version, language, script, status, translation_review, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
    newId("aud"), p.id, p.version, lang, lang === "en" ? draftScript(db, p) : null, "draft", lang === "zh" ? "unreviewed" : "not_applicable", now, now,
  );
  return audioRow(db, p, lang)!;
}

export function audioOverview(db: Db) {
  const props = all<ProposalRow>(db, "SELECT * FROM proposals WHERE published = 1 ORDER BY is_sample, updated_at DESC");
  return props.map((p) => {
    const en = ensureRow(db, p, "en");
    const zh = audioRow(db, p, "zh");
    const view = (a: AudioRow | undefined) =>
      a && {
        id: a.id,
        status: a.status,
        method: a.method,
        script: a.script,
        script_approved: !!a.script_approved,
        words: a.script ? wordCount(a.script) : 0,
        url: a.status === "ready" ? `/media/audio/${a.id}` : null,
        translation_review: a.translation_review,
        error: a.error,
        updated_at: a.updated_at,
      };
    return { proposal: { id: p.id, title: p.title, version: p.version, is_sample: !!p.is_sample }, en: view(en), zh: view(zh) };
  });
}

export function saveScript(db: Db, proposalId: string, script: string, approve: boolean) {
  const p = getProposal(db, proposalId);
  if (!p) throw new HttpError(404, "Proposal not found");
  const row = ensureRow(db, p, "en");
  if (row.status === "ready" || row.status === "pending") throw new HttpError(409, "Audio already generated for this version. Publish a new version to change the script.");
  const words = wordCount(script);
  if (approve && (words < 30 || words > 130)) throw new HttpError(400, `Script is ${words} words; aim for roughly 60–90 (allowed 30–130).`);
  run(db, "UPDATE audio SET script=?, script_approved=?, updated_at=? WHERE id=?", script.trim(), approve ? 1 : 0, nowIso(), row.id);
}

export async function tts(text: string, languageCode?: string): Promise<Buffer> {
  const res = await fetch(`${XI}/text-to-speech/${config.elevenlabs.voiceId}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: xiHeaders({ "Content-Type": "application/json", Accept: "audio/mpeg" }),
    body: JSON.stringify({ text, model_id: config.elevenlabs.ttsModel, ...(languageCode ? { language_code: languageCode } : {}) }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`ElevenLabs TTS failed (${res.status}): ${await xiError(res)}`);
  return Buffer.from(await res.arrayBuffer());
}

export function saveFile(id: string, ext: string, buf: Buffer): string {
  fs.mkdirSync(config.audioDir, { recursive: true });
  const fp = path.join(config.audioDir, `${id}${ext}`);
  fs.writeFileSync(fp, buf);
  return fp;
}

export async function generateEnglish(db: Db, proposalId: string): Promise<void> {
  const p = getProposal(db, proposalId);
  if (!p) throw new HttpError(404, "Proposal not found");
  const row = ensureRow(db, p, "en");
  if (!row.script_approved || !row.script) throw new HttpError(400, "Approve the English script first.");
  if (row.status === "ready") return; // cached per proposal version
  run(db, "UPDATE audio SET status='pending', method='tts', error=NULL, updated_at=? WHERE id=?", nowIso(), row.id);
  try {
    const buf = await tts(row.script);
    const fp = saveFile(row.id, ".mp3", buf);
    run(db, "UPDATE audio SET status='ready', file_path=?, mime_type='audio/mpeg', updated_at=? WHERE id=?", fp, nowIso(), row.id);
  } catch (e) {
    run(db, "UPDATE audio SET status='failed', error=?, updated_at=? WHERE id=?", (e as Error).message, nowIso(), row.id);
    throw e;
  }
}

export interface DubJob {
  project_id: string;
  language_id: string;
}

/** Queue an ElevenLabs Dubbing job that translates an English MP3 into the configured target language. */
export async function startDubJob(englishMp3Path: string, reference: string): Promise<DubJob> {
  const form = new FormData();
  form.append("file", new Blob([fs.readFileSync(englishMp3Path)], { type: "audio/mpeg" }), "briefing-en.mp3");
  form.append("source_language", "en");
  form.append("target_language", config.elevenlabs.dubbingTarget);
  form.append("reference", reference);
  const res = await fetch(`${XI}/dubbing/project`, { method: "POST", headers: xiHeaders(), body: form, signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`ElevenLabs dubbing failed (${res.status}): ${await xiError(res)}`);
  const body = (await res.json()) as { project_id: string; language_ids?: string[] };
  let languageId = body.language_ids?.[0];
  if (!languageId) {
    const lr = await fetch(`${XI}/dubbing/project/${body.project_id}/language`, {
      method: "POST",
      headers: xiHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ target_language: config.elevenlabs.dubbingTarget }),
    });
    if (!lr.ok) throw new Error(`ElevenLabs language target failed (${lr.status}): ${await xiError(lr)}`);
    languageId = ((await lr.json()) as { language_id: string }).language_id;
  }
  return { project_id: body.project_id, language_id: languageId };
}

export type DubResult = { state: "pending" } | { state: "failed"; error: string } | { state: "ready"; audio: Buffer; transcript: string | null };

/** Check one dubbing job; when finished, download the FLAC and the translated transcript. */
export async function fetchDubResult(job: DubJob): Promise<DubResult> {
  const res = await fetch(`${XI}/dubbing/project/${job.project_id}/language/${job.language_id}`, { headers: xiHeaders() });
  if (!res.ok) throw new Error(`status ${res.status}: ${await xiError(res)}`);
  const lang = (await res.json()) as { status: string; outputs?: { lossless_audio?: string | null } | null; error?: { error?: string } | null };
  if (lang.status === "failed") return { state: "failed", error: `Dubbing failed: ${lang.error?.error ?? "unknown"}` };
  if (lang.status !== "completed" || !lang.outputs?.lossless_audio) return { state: "pending" };
  const audio = await fetch(lang.outputs.lossless_audio);
  if (!audio.ok) throw new Error(`download failed (${audio.status})`);
  let transcript: string | null = null;
  const tr = await fetch(`${XI}/dubbing/project/${job.project_id}/language/${job.language_id}/transcript`, { headers: xiHeaders() });
  if (tr.ok) {
    const t = (await tr.json()) as { segments: { translation?: string | null }[] };
    transcript = t.segments.map((s) => s.translation ?? "").join("").trim() || null;
  }
  return { state: "ready", audio: Buffer.from(await audio.arrayBuffer()), transcript };
}

/** Chinese via the ElevenLabs Dubbing API: translate the English audio (asynchronous job). */
export async function startChineseDub(db: Db, proposalId: string): Promise<void> {
  const p = getProposal(db, proposalId);
  if (!p) throw new HttpError(404, "Proposal not found");
  const en = audioRow(db, p, "en");
  if (!en || en.status !== "ready" || !en.file_path) throw new HttpError(400, "Generate the English audio first — the dub translates it.");
  const zh = ensureRow(db, p, "zh");
  if (zh.status === "pending" || zh.status === "ready") return;
  run(db, "UPDATE audio SET status='pending', method='dubbing', error=NULL, updated_at=? WHERE id=?", nowIso(), zh.id);
  try {
    const job = await startDubJob(en.file_path, `before-the-vote ${p.id} v${p.version}`);
    run(db, "UPDATE audio SET provider_job_json=?, updated_at=? WHERE id=?", JSON.stringify(job), nowIso(), zh.id);
  } catch (e) {
    run(db, "UPDATE audio SET status='failed', error=?, updated_at=? WHERE id=?", (e as Error).message, nowIso(), zh.id);
    throw e;
  }
}

/** Poll pending dubbing jobs; download the finished FLAC and the translated transcript. */
export async function pollDubs(db: Db): Promise<void> {
  if (!config.elevenlabs.enabled) return;
  const pending = all<AudioRow>(db, "SELECT * FROM audio WHERE status='pending' AND method='dubbing' AND provider_job_json IS NOT NULL");
  for (const a of pending) {
    try {
      const r = await fetchDubResult(JSON.parse(a.provider_job_json!) as DubJob);
      if (r.state === "failed") run(db, "UPDATE audio SET status='failed', error=?, updated_at=? WHERE id=?", r.error, nowIso(), a.id);
      if (r.state !== "ready") continue;
      const fp = saveFile(a.id, ".flac", r.audio);
      run(db, "UPDATE audio SET status='ready', file_path=?, mime_type='audio/flac', script=?, translation_review='unreviewed', updated_at=? WHERE id=?", fp, r.transcript, nowIso(), a.id);
    } catch (e) {
      console.warn(`[audio] dub poll ${a.id}:`, (e as Error).message);
    }
  }
}

/** Chinese without translation: ElevenLabs reads the Chinese title and summary the proposal page shows. */
export async function generateChineseFromPage(db: Db, proposalId: string): Promise<void> {
  const p = getProposal(db, proposalId);
  if (!p) throw new HttpError(404, "Proposal not found");
  if (!p.title_zh || !p.summary_zh) throw new HttpError(400, "This proposal has no Chinese title and summary on its page yet.");
  const zh = ensureRow(db, p, "zh");
  if (zh.status === "pending") throw new HttpError(409, "A Chinese job is already running.");
  const script = `${p.title_zh.trim().replace(/[。.]$/, "")}。${p.summary_zh.trim()}官方文件的链接在本页。`;
  run(db, "UPDATE audio SET status='pending', method='tts_page', error=NULL, provider_job_json=NULL, updated_at=? WHERE id=?", nowIso(), zh.id);
  try {
    const fp = saveFile(zh.id, ".mp3", await tts(script));
    run(db, "UPDATE audio SET status='ready', script=?, file_path=?, mime_type='audio/mpeg', translation_review='unreviewed', updated_at=? WHERE id=?", script, fp, nowIso(), zh.id);
  } catch (e) {
    run(db, "UPDATE audio SET status='failed', error=?, updated_at=? WHERE id=?", (e as Error).message, nowIso(), zh.id);
    throw e;
  }
}

/** Fallback when dubbing is unavailable: Grok translates the approved script, ElevenLabs narrates it. */
export async function generateChineseFallback(db: Db, proposalId: string): Promise<void> {
  const p = getProposal(db, proposalId);
  if (!p) throw new HttpError(404, "Proposal not found");
  const en = audioRow(db, p, "en");
  if (!en?.script_approved || !en.script) throw new HttpError(400, "Approve the English script first.");
  const zh = ensureRow(db, p, "zh");
  if (zh.status === "pending") throw new HttpError(409, "A Chinese job is already running.");
  run(db, "UPDATE audio SET status='pending', method='tts_translated', error=NULL, provider_job_json=NULL, updated_at=? WHERE id=?", nowIso(), zh.id);
  try {
    const script = await translateScriptToChinese(en.script);
    const fp = saveFile(zh.id, ".mp3", await tts(script, "zh"));
    run(db, "UPDATE audio SET status='ready', script=?, file_path=?, mime_type='audio/mpeg', translation_review='unreviewed', updated_at=? WHERE id=?", script, fp, nowIso(), zh.id);
  } catch (e) {
    run(db, "UPDATE audio SET status='failed', error=?, updated_at=? WHERE id=?", (e as Error).message, nowIso(), zh.id);
    throw e;
  }
}

const CURSOR_TRANSLATION_SCHEMA = z.object({ title_zh: z.string().min(1), summary_zh: z.string().min(1), script_zh: z.string().min(1) });

/** Manual Grok route (no xAI API credit): one prompt for Grok in Cursor that returns the card text and spoken script in Chinese. */
export function chineseCursorPrompt(db: Db, proposalId: string): string {
  const p = getProposal(db, proposalId);
  if (!p) throw new HttpError(404, "Proposal not found");
  const en = audioRow(db, p, "en");
  if (!en?.script_approved || !en.script) throw new HttpError(400, "Approve the English script first.");
  return `Translate this civic information from English to Simplified Chinese for residents of Queens, New York.
Keep every name, street address, number, date and time exactly equivalent (addresses may stay in English). Do not add or drop information.
- title_zh and summary_zh: written text for the proposal card.
- script_zh: natural spoken Chinese for a short audio briefing.

Reply with ONLY this JSON object. No prose, no code fences, no tools, no file edits:
{"title_zh": "...", "summary_zh": "...", "script_zh": "..."}

${JSON.stringify({ title: p.title, summary: p.summary, script: en.script }, null, 2)}`;
}

/** Store Grok's pasted Chinese card text, then narrate its script with ElevenLabs. Labelled as an unreviewed translation. */
export async function generateChineseFromPasted(db: Db, proposalId: string, raw: string): Promise<void> {
  const p = getProposal(db, proposalId);
  if (!p) throw new HttpError(404, "Proposal not found");
  const en = audioRow(db, p, "en");
  if (!en?.script_approved || !en.script) throw new HttpError(400, "Approve the English script first.");
  const parsed = CURSOR_TRANSLATION_SCHEMA.safeParse(parseJsonReply(raw));
  if (!parsed.success) throw new HttpError(400, "Paste Grok's JSON with title_zh, summary_zh and script_zh.");
  const t = parsed.data;
  const zh = ensureRow(db, p, "zh");
  if (zh.status === "pending") throw new HttpError(409, "A Chinese job is already running.");
  run(db, "UPDATE proposals SET title_zh=?, summary_zh=? WHERE id=? AND version=?", t.title_zh.trim(), t.summary_zh.trim(), p.id, p.version);
  run(db, "UPDATE audio SET status='pending', method='tts_translated_cursor', error=NULL, provider_job_json=NULL, updated_at=? WHERE id=?", nowIso(), zh.id);
  try {
    const script = t.script_zh.trim();
    const fp = saveFile(zh.id, ".mp3", await tts(script, "zh"));
    run(db, "UPDATE audio SET status='ready', script=?, file_path=?, mime_type='audio/mpeg', translation_review='unreviewed', updated_at=? WHERE id=?", script, fp, nowIso(), zh.id);
  } catch (e) {
    run(db, "UPDATE audio SET status='failed', error=?, updated_at=? WHERE id=?", (e as Error).message, nowIso(), zh.id);
    throw e;
  }
}

export function setTranslationReview(db: Db, proposalId: string, reviewed: boolean) {
  const p = getProposal(db, proposalId);
  if (!p) throw new HttpError(404, "Proposal not found");
  const zh = audioRow(db, p, "zh");
  if (!zh || zh.status !== "ready") throw new HttpError(400, "No Chinese audio to review yet.");
  run(db, "UPDATE audio SET translation_review=?, updated_at=? WHERE id=?", reviewed ? "reviewed" : "unreviewed", nowIso(), zh.id);
}

export function resetChinese(db: Db, proposalId: string) {
  const p = getProposal(db, proposalId);
  if (!p) throw new HttpError(404, "Proposal not found");
  const zh = audioRow(db, p, "zh");
  if (zh) run(db, "UPDATE audio SET status='draft', method=NULL, provider_job_json=NULL, error=NULL, updated_at=? WHERE id=?", nowIso(), zh.id);
}

export function getAudioFile(db: Db, id: string): AudioRow | undefined {
  return get<AudioRow>(db, "SELECT * FROM audio WHERE id = ? AND status = 'ready'", id);
}
