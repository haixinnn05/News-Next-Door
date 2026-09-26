import { config } from "../config.ts";
import { all, get, run, tx, type Db } from "../db.ts";
import { ADDRESS_INDEX, addressByKey, BOARD, findAddress, looksLikeAddress, matchLocationText } from "../lib/addresses.ts";
import { HttpError, newId, nowIso, nycToUtcIso } from "../lib/util.ts";
import { getDocument, type DocumentRow } from "./documents.ts";
import { getDraft, hasBlockingIssues, validateDraft, draftDataSchema, type DraftData, type Issue } from "./extraction.ts";
import { getPages } from "./documents.ts";
import { onProposalPublished } from "./notifications.ts";

export interface ProposalRow {
  id: string;
  board: string;
  title: string;
  title_zh: string | null;
  category: string;
  location_text: string | null;
  address_key: string | null;
  summary: string;
  summary_zh: string | null;
  purpose: string | null;
  stage: string | null;
  stage_kind: string;
  proposed_by: string | null;
  participation: string | null;
  body_name: string | null;
  version: number;
  is_sample: number;
  published: number;
  last_checked_at: string;
  published_at: string;
  created_at: string;
  updated_at: string;
}

export interface EventRow {
  id: string;
  proposal_id: string;
  event_key: string;
  type: string;
  title: string;
  description: string | null;
  date: string | null;
  time: string | null;
  starts_at: string | null;
  timezone: string;
  location: string | null;
  meeting_url: string | null;
  comment_deadline: string | null;
  instructions: string | null;
  cancelled: number;
  is_demo: number;
  sort_order: number;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface AudioRow {
  id: string;
  proposal_id: string;
  proposal_version: number;
  language: "en" | "zh";
  script: string | null;
  script_approved: number;
  method: string | null;
  provider_job_json: string | null;
  status: string;
  file_path: string | null;
  mime_type: string | null;
  duration_s: number | null;
  translation_review: string;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export const MEETING_TYPES = new Set(["community_discussion", "committee_meeting", "public_hearing", "board_meeting"]);

export function getProposal(db: Db, id: string): ProposalRow | undefined {
  return get<ProposalRow>(db, "SELECT * FROM proposals WHERE id = ?", id);
}
export function getEvents(db: Db, proposalId: string): EventRow[] {
  return all<EventRow>(db, "SELECT * FROM events WHERE proposal_id = ? ORDER BY sort_order, COALESCE(date, '9999'), created_at", proposalId);
}
export function getAudioRows(db: Db, proposalId: string, version: number): AudioRow[] {
  return all<AudioRow>(db, "SELECT * FROM audio WHERE proposal_id = ? AND proposal_version = ?", proposalId, version);
}

export function eventTiming(e: EventRow, now = Date.now()): "upcoming" | "past" | "tbd" | "cancelled" {
  if (e.cancelled) return "cancelled";
  if (e.starts_at) return Date.parse(e.starts_at) > now ? "upcoming" : "past";
  if (e.date) {
    // date-only: treat as upcoming through the end of that NYC day
    return Date.parse(nycToUtcIso(e.date, "23:59")) > now ? "upcoming" : "past";
  }
  return "tbd";
}

export function nextEvent(events: EventRow[], now = Date.now()): EventRow | undefined {
  return events
    .filter((e) => eventTiming(e, now) === "upcoming")
    .sort((a, b) => (a.starts_at ?? `${a.date}T23:59`).localeCompare(b.starts_at ?? `${b.date}T23:59`))[0];
}

function publicEvent(e: EventRow, now: number) {
  return {
    id: e.id,
    key: e.event_key,
    type: e.type,
    title: e.title,
    description: e.description,
    date: e.date,
    time: e.time,
    starts_at: e.starts_at,
    timezone: e.timezone,
    location: e.location,
    meeting_url: e.meeting_url,
    comment_deadline: e.comment_deadline,
    instructions: e.instructions,
    cancelled: !!e.cancelled,
    is_demo: !!e.is_demo,
    timing: eventTiming(e, now),
  };
}
export type PublicEvent = ReturnType<typeof publicEvent>;

function publicDocument(d: DocumentRow) {
  return {
    id: d.id,
    title: d.title,
    official_url: d.official_url,
    publication_date: d.publication_date,
    retrieved_at: d.retrieved_at,
    page_count: d.page_count,
    mime_type: d.mime_type,
    is_sample: !!d.is_sample,
    file_url: `/media/documents/${d.id}`,
  };
}

function publicAudio(a: AudioRow | undefined) {
  if (!a) return null;
  return {
    language: a.language,
    status: a.status,
    method: a.method,
    url: a.status === "ready" && a.file_path ? `/media/audio/${a.id}` : null,
    transcript: a.language === "en" ? (a.script_approved ? a.script : null) : a.status === "ready" ? a.script : null,
    translation_review: a.translation_review,
    duration_s: a.duration_s,
    error: a.status === "failed" ? "Audio is temporarily unavailable." : null,
  };
}

export function proposalCard(db: Db, p: ProposalRow, now = Date.now()) {
  const events = getEvents(db, p.id);
  const next = nextEvent(events, now);
  const addr = addressByKey(p.address_key);
  return {
    id: p.id,
    title: p.title,
    title_zh: p.title_zh,
    category: p.category,
    location_text: p.location_text,
    address: addr ? { key: addr.key, label: addr.label, full: addr.full, neighborhood: addr.neighborhood, lat: addr.lat, lng: addr.lng } : null,
    summary: p.summary,
    summary_zh: p.summary_zh,
    stage: p.stage,
    stage_kind: p.stage_kind,
    is_sample: !!p.is_sample,
    last_checked_at: p.last_checked_at,
    next_event: next ? publicEvent(next, now) : null,
  };
}
export type ProposalCard = ReturnType<typeof proposalCard>;

export function proposalDetail(db: Db, p: ProposalRow, now = Date.now()) {
  const docs = all<DocumentRow>(db, "SELECT d.* FROM documents d JOIN proposal_documents pd ON pd.document_id = d.id WHERE pd.proposal_id = ? ORDER BY d.publication_date DESC, d.created_at DESC", p.id);
  const evidence = all<{ field: string; document_id: string; page: number; excerpt: string }>(
    db,
    "SELECT field, document_id, page, excerpt FROM evidence WHERE proposal_id = ? AND version = ? ORDER BY field",
    p.id, p.version,
  );
  const audio = getAudioRows(db, p.id, p.version);
  return {
    ...proposalCard(db, p, now),
    purpose: p.purpose,
    proposed_by: p.proposed_by,
    participation: p.participation,
    body_name: p.body_name,
    version: p.version,
    published_at: p.published_at,
    events: getEvents(db, p.id).map((e) => publicEvent(e, now)),
    documents: docs.map(publicDocument),
    evidence,
    audio: { en: publicAudio(audio.find((a) => a.language === "en")), zh: publicAudio(audio.find((a) => a.language === "zh")) },
  };
}
export type ProposalDetail = ReturnType<typeof proposalDetail>;

export function listPublished(db: Db): ProposalRow[] {
  return all<ProposalRow>(
    db,
    `SELECT * FROM proposals WHERE published = 1 ${config.showSampleData ? "" : "AND is_sample = 0"} ORDER BY is_sample ASC, updated_at DESC`,
  );
}

export function search(db: Db, q: string, category?: string) {
  const now = Date.now();
  let rows = listPublished(db);
  if (category && category !== "all") rows = rows.filter((r) => r.category === category);
  const query = q.trim();
  if (!query) return { status: "ok" as const, matched_address: null, results: rows.map((r) => proposalCard(db, r, now)) };

  const addr = findAddress(query);
  if (addr) {
    const at = rows.filter((r) => r.address_key === addr.key);
    return {
      status: at.length ? ("ok" as const) : ("no_proposals_at_address" as const),
      matched_address: { key: addr.key, label: addr.label, full: addr.full, neighborhood: addr.neighborhood },
      results: at.map((r) => proposalCard(db, r, now)),
    };
  }
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const hits = rows.filter((r) => {
    const hay = [r.title, r.title_zh, r.location_text, r.summary, r.proposed_by, addressByKey(r.address_key)?.full].filter(Boolean).join(" ").toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
  if (!hits.length && looksLikeAddress(query)) return { status: "unsupported_address" as const, matched_address: null, results: [] };
  return { status: hits.length ? ("ok" as const) : ("empty" as const), matched_address: null, results: hits.map((r) => proposalCard(db, r, now)) };
}

// ---------------------------------------------------------------- publishing

export interface PublishChange {
  kind: "new_event" | "rescheduled" | "cancelled" | "stage" | "details";
  message: string;
  event_id?: string;
}

function eventStartsAt(date: string | null, time: string | null): string | null {
  return date && time ? nycToUtcIso(date, time) : null;
}

/**
 * Publish a reviewed draft: creates the proposal (or a new version of an existing one), copies
 * evidence, reconciles events (reschedules/cancellations invalidate queued reminders), and queues
 * update drafts for subscribers. Returns the proposal and a list of material changes.
 */
export function publishDraft(db: Db, draftId: string, opts: { targetProposalId?: string | null; isSample?: boolean } = {}) {
  const draft = getDraft(db, draftId);
  if (!draft) throw new HttpError(404, "Draft not found");
  if (draft.status === "published") throw new HttpError(409, "Draft already published");
  const doc = getDocument(db, draft.document_id)!;
  const data = draftDataSchema.parse(JSON.parse(draft.data_json)) as DraftData;
  const issues: Issue[] = validateDraft(data, doc, getPages(db, doc.id));
  if (hasBlockingIssues(issues)) throw new HttpError(422, `Resolve the flagged issues before publishing: ${issues.filter((i) => i.level === "error").map((i) => i.message).join(" ")}`);

  const targetId = opts.targetProposalId ?? draft.proposal_id ?? null;
  const existing = targetId ? getProposal(db, targetId) : undefined;
  if (targetId && !existing) throw new HttpError(404, "Target proposal not found");
  const now = nowIso();
  const addressKey = data.address_key ?? matchLocationText(data.location_text)?.key ?? matchLocationText(data.title)?.key ?? null;
  const changes: PublishChange[] = [];

  const proposalId = tx(db, () => {
    let id: string;
    let version: number;
    if (!existing) {
      id = newId("prp");
      version = 1;
      run(
        db,
        `INSERT INTO proposals (id, board, title, category, location_text, address_key, summary, purpose, stage, stage_kind, proposed_by, participation, body_name, version, is_sample, published, last_checked_at, published_at, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?,?,?)`,
        id, BOARD.id, data.title, data.category, data.location_text, addressKey, data.summary, data.purpose, data.stage, data.stage_kind, data.proposed_by, data.participation, data.body_name, version, opts.isSample || doc.is_sample ? 1 : 0, now, now, now, now,
      );
    } else {
      id = existing.id;
      version = existing.version + 1;
      if (data.stage && data.stage !== existing.stage) changes.push({ kind: "stage", message: `Stage is now: ${data.stage}` });
      // Null in a newer document means "not listed there", so keep facts established by earlier sources.
      run(
        db,
        `UPDATE proposals SET title=?, category=?, location_text=COALESCE(?, location_text), address_key=COALESCE(?, address_key), summary=?, purpose=COALESCE(?, purpose),
           stage=COALESCE(?, stage), stage_kind=CASE WHEN ?='unknown' THEN stage_kind ELSE ? END, proposed_by=COALESCE(?, proposed_by), participation=COALESCE(?, participation),
           body_name=COALESCE(?, body_name), version=?, published=1, last_checked_at=?, published_at=?, updated_at=?,
           title_zh=CASE WHEN title=? THEN title_zh ELSE NULL END, summary_zh=CASE WHEN summary=? THEN summary_zh ELSE NULL END
         WHERE id=?`,
        data.title, data.category, data.location_text, addressKey, data.summary, data.purpose, data.stage, data.stage_kind, data.stage_kind, data.proposed_by, data.participation, data.body_name,
        version, now, now, now, data.title, data.summary, id,
      );
      // carry forward evidence for fields this document does not speak to
      const newFields = new Set(data.evidence.map((e) => e.field));
      for (const ev of all<{ field: string; document_id: string; page: number; excerpt: string }>(db, "SELECT field, document_id, page, excerpt FROM evidence WHERE proposal_id=? AND version=?", id, existing.version)) {
        if (!newFields.has(ev.field)) run(db, "INSERT INTO evidence (id, proposal_id, version, field, document_id, page, excerpt) VALUES (?,?,?,?,?,?,?)", newId("evd"), id, version, ev.field, ev.document_id, ev.page, ev.excerpt);
      }
    }
    for (const ev of data.evidence) run(db, "INSERT INTO evidence (id, proposal_id, version, field, document_id, page, excerpt) VALUES (?,?,?,?,?,?,?)", newId("evd"), id, version, ev.field, doc.id, ev.page, ev.excerpt);
    run(db, "INSERT OR IGNORE INTO proposal_documents (proposal_id, document_id) VALUES (?,?)", id, doc.id);

    // reconcile events
    const current = getEvents(db, id);
    data.events.forEach((e, i) => {
      const startsAt = eventStartsAt(e.date, e.time);
      const match = current.find((c) => c.event_key === e.key) ?? current.find((c) => c.type === e.type && c.type !== "other" && c.title === e.title);
      if (!match) {
        run(
          db,
          `INSERT INTO events (id, proposal_id, event_key, type, title, description, date, time, starts_at, location, meeting_url, comment_deadline, instructions, cancelled, is_demo, sort_order, version, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)`,
          newId("evt"), id, e.key, e.type, e.title, e.description, e.date, e.time, startsAt, e.location, e.meeting_url, e.comment_deadline, e.instructions, e.cancelled ? 1 : 0, e.is_demo ? 1 : 0, i, now, now,
        );
        if (existing && startsAt && Date.parse(startsAt) > Date.now()) changes.push({ kind: "new_event", message: `New: ${e.title}` });
        return;
      }
      const date = e.date ?? match.date;
      const time = e.time ?? match.time;
      const newStarts = eventStartsAt(date, time);
      const rescheduled = (e.date && e.date !== match.date) || (e.time && e.time !== match.time);
      const cancelled = e.cancelled && !match.cancelled;
      const material = rescheduled || cancelled || (e.location && e.location !== match.location);
      run(
        db,
        `UPDATE events SET type=?, title=?, description=COALESCE(?, description), date=?, time=?, starts_at=?, location=COALESCE(?, location), meeting_url=COALESCE(?, meeting_url),
           comment_deadline=COALESCE(?, comment_deadline), instructions=COALESCE(?, instructions), cancelled=?, sort_order=?, version=version + ?, updated_at=? WHERE id=?`,
        e.type, e.title, e.description, date, time, newStarts, e.location, e.meeting_url, e.comment_deadline, e.instructions, e.cancelled ? 1 : match.cancelled, i, material ? 1 : 0, now, match.id,
      );
      if (cancelled) changes.push({ kind: "cancelled", message: `Cancelled: ${e.title}`, event_id: match.id });
      else if (rescheduled) changes.push({ kind: "rescheduled", message: `Rescheduled: ${e.title} is now ${[date, time].filter(Boolean).join(" ")}`, event_id: match.id });
      else if (material) changes.push({ kind: "details", message: `Location changed: ${e.title} — ${e.location}`, event_id: match.id });
    });

    run(db, "UPDATE drafts SET status='published', proposal_id=?, updated_at=? WHERE id=?", id, now, draftId);
    return id;
  });

  const proposal = getProposal(db, proposalId)!;
  const queued = onProposalPublished(db, proposal, changes, !!existing);
  return { proposal, changes, updateDrafts: queued, issues };
}

export function coverage() {
  return {
    board: BOARD,
    addresses: ADDRESS_INDEX.map(({ key, label, full, neighborhood, lat, lng }) => ({ key, label, full, neighborhood, lat, lng })),
  };
}
