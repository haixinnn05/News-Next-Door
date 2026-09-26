import fs from "node:fs";
import path from "node:path";
import { Hono, type Context } from "hono";
import QRCode from "qrcode";
import { isTeamEmail, type Auth } from "../auth.ts";
import { config } from "../config.ts";
import { all, get, run, type Db } from "../db.ts";
import { BOARD } from "../lib/addresses.ts";
import { HttpError, newId, nowIso, nycToUtcIso } from "../lib/util.ts";
import { myProposals, setSaved } from "../services/account.ts";
import * as audio from "../services/audio.ts";
import { fetchRemote, getDocument, getPages, importDocument, type DocumentRow } from "../services/documents.ts";
import { extractDocument, extractionPrompt, importPastedExtraction, getDraft, listDrafts, saveDraft, CATEGORIES, EVENT_TYPES, STAGE_KINDS, type DraftRow } from "../services/extraction.ts";
import { summarizeApplication, translateCardToChinese } from "../services/grok.ts";
import { queueTestMessage, reconcileReminders, runDueNotifications, type NotificationRow, type SubscriberRow } from "../services/notifications.ts";
import { coverage, getProposal, listPublished, proposalCard, proposalDetail, publishDraft, search, type ProposalRow } from "../services/proposals.ts";
import { createFollowCode, followStatus, handleInbound } from "../services/subscriptions.ts";
import { BOARDS, boardById, DEFAULT_BOARD_ID } from "../lib/boards.ts";
import { communityDistrictBoundary } from "../services/boundary.ts";
import { applicationById, districtApplications } from "../services/zap.ts";

const MIME: Record<string, string> = { ".mp3": "audio/mpeg", ".flac": "audio/flac", ".pdf": "application/pdf", ".html": "text/html; charset=utf-8" };

function sendFile(c: Context, filePath: string, type?: string) {
  if (!fs.existsSync(filePath)) return c.json({ error: "Not found" }, 404);
  const stat = fs.statSync(filePath);
  const ct = type ?? MIME[path.extname(filePath)] ?? "application/octet-stream";
  const range = c.req.header("range");
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    const start = m?.[1] ? Number(m[1]) : 0;
    const end = m?.[2] ? Number(m[2]) : stat.size - 1;
    const buf = fs.readFileSync(filePath).subarray(start, end + 1);
    return new Response(buf, { status: 206, headers: { "Content-Type": ct, "Content-Range": `bytes ${start}-${end}/${stat.size}`, "Accept-Ranges": "bytes", "Content-Length": String(buf.length) } });
  }
  return new Response(fs.readFileSync(filePath), { headers: { "Content-Type": ct, "Accept-Ranges": "bytes", "Content-Length": String(stat.size), "Cache-Control": "public, max-age=300" } });
}

const maskHandle = (h: string) => (h.includes("@") ? h.replace(/^(.{2}).*(@.*)$/, "$1•••$2") : h.replace(/^(\+?\d{0,2})\d*(\d{4})$/, "$1 ••• $2"));

type TeamMember = { email: string; name: string; image: string | null };

export function createApp(db: Db, opts: { photonEnabled: boolean; auth: Auth }) {
  const app = new Hono();
  const { auth } = opts;
  const teamSignIn = config.auth.googleEnabled ? "google" : "token";
  const sessionOf = (c: Context) => auth.api.getSession({ headers: c.req.raw.headers });
  const requireUser = async (c: Context) => {
    const session = await sessionOf(c);
    if (!session) throw new HttpError(401, "Sign in first.");
    return session.user;
  };

  app.onError((err, c) => {
    const status = err instanceof HttpError ? err.status : 500;
    if (status >= 500) console.error("[http]", err);
    return c.json({ error: err.message || "Server error" }, status as 400);
  });

  app.all("/api/auth/*", (c) => auth.handler(c.req.raw));

  // ------------------------------------------------------------ public
  app.get("/api/meta", (c) =>
    c.json({
      board: BOARD,
      coverage: coverage(),
      messaging: {
        mode: opts.photonEnabled ? "photon" : "simulator",
        line_address: opts.photonEnabled ? config.photon.lineAddress || null : null,
      },
      integrations: { grok: config.grok.enabled, elevenlabs: config.elevenlabs.enabled, photon: opts.photonEnabled },
      show_sample_data: config.showSampleData,
      reminder_lead_hours: config.reminderLeadHours,
      team_sign_in: teamSignIn,
      account_sign_in: { email: true, google: config.auth.googleEnabled },
    }),
  );

  // ------------------------------------------------------------ signed-in residents
  app.get("/api/me/proposals", async (c) => {
    const user = await requireUser(c);
    return c.json(await myProposals(db, user.id, maskHandle));
  });
  app.put("/api/me/saved/:id", async (c) => {
    const user = await requireUser(c);
    await setSaved(db, user.id, c.req.param("id"), true);
    return c.json({ ok: true });
  });
  app.delete("/api/me/saved/:id", async (c) => {
    const user = await requireUser(c);
    await setSaved(db, user.id, c.req.param("id"), false);
    return c.json({ ok: true });
  });

  app.get("/api/proposals", (c) => {
    const r = search(db, c.req.query("q") ?? "", c.req.query("category") ?? "all");
    return c.json(r);
  });

  app.get("/api/boards", (c) => c.json({ default_id: DEFAULT_BOARD_ID, boards: BOARDS }));

  app.get("/api/boards/:id/boundary", async (c) => {
    const board = boardById(c.req.param("id"));
    if (!board) throw new HttpError(404, "Unknown community board");
    return c.json({ board_id: board.id, geometry: await communityDistrictBoundary(board.boroCd) });
  });

  app.get("/api/applications", async (c) => {
    const board = boardById(c.req.query("board") || DEFAULT_BOARD_ID);
    if (!board) throw new HttpError(404, "Unknown community board");
    return c.json(await districtApplications(board));
  });

  app.get("/api/applications/:id", async (c) => c.json(await applicationById(c.req.param("id"))));

  app.post("/api/applications/:id/summarize", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { language?: string };
    const app = await applicationById(c.req.param("id"));
    const { summary, model } = await summarizeApplication(
      {
        name: app.name,
        brief: app.brief,
        public_status: app.public_status,
        applicant: app.applicant,
        districts: app.districts,
        location: app.location?.label ?? null,
        milestone: app.milestone,
        actions: app.actions.map((action) => action.label),
      },
      body.language || "en",
    );
    return c.json({ summary, model });
  });

  app.get("/api/proposals/:id", (c) => {
    const p = getProposal(db, c.req.param("id"));
    if (!p || !p.published || (p.is_sample && !config.showSampleData)) throw new HttpError(404, "Proposal not found");
    return c.json(proposalDetail(db, p));
  });

  app.post("/api/proposals/:id/follow", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { language?: string };
    const session = await sessionOf(c);
    const fc = createFollowCode(db, c.req.param("id"), body.language === "zh" ? "zh" : "en", session?.user.id ?? null);
    const line = config.photon.lineAddress;
    const link = opts.photonEnabled && line ? `sms:${line}&body=${encodeURIComponent(fc.code)}` : `/phone?code=${encodeURIComponent(fc.code)}`;
    const qrTarget = link.startsWith("/") ? `${config.publicBaseUrl}${link}` : link;
    const qr_svg = await QRCode.toString(qrTarget, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#14261d", light: "#00000000" } });
    return c.json({ code: fc.code, expires_at: fc.expires_at, link, qr_svg, line_address: opts.photonEnabled ? line || null : null, mode: opts.photonEnabled ? "photon" : "simulator" });
  });

  app.get("/api/follow/:code", (c) => c.json(followStatus(db, c.req.param("code"))));

  app.get("/media/audio/:id", (c) => {
    const a = audio.getAudioFile(db, c.req.param("id"));
    if (!a?.file_path) throw new HttpError(404, "Audio not found");
    return sendFile(c, a.file_path, a.mime_type ?? undefined);
  });
  app.get("/media/documents/:id", (c) => {
    const d = getDocument(db, c.req.param("id"));
    if (!d) throw new HttpError(404, "Document not found");
    return sendFile(c, d.file_path, d.mime_type.startsWith("text/html") ? "text/html; charset=utf-8" : d.mime_type);
  });
  app.get("/samples/:file", (c) => {
    const f = path.basename(c.req.param("file"));
    return sendFile(c, path.join(config.serverRoot, "seed", "samples", f));
  });

  // Simulated phone (only meaningful without Photon; always labelled SIMULATED in the UI)
  app.post("/api/sim/inbound", async (c) => {
    const { handle, text } = (await c.req.json()) as { handle?: string; text?: string };
    if (!handle || !text) throw new HttpError(400, "handle and text required");
    run(db, "INSERT INTO sim_messages (handle, direction, text, at) VALUES (?,?,?,?)", handle, "from_phone", text, nowIso());
    const r = handleInbound(db, { providerEventId: newId("sim"), handle, spaceId: null, text, transport: "simulator" });
    await runDueNotifications(db);
    return c.json(r);
  });
  app.get("/api/sim/thread", (c) => {
    const handle = c.req.query("handle") ?? "";
    return c.json(all(db, "SELECT id, direction, text, at FROM sim_messages WHERE handle = ? ORDER BY id", handle));
  });

  // ------------------------------------------------------------ admin (team only)
  const admin = new Hono<{ Variables: { member: TeamMember | null } }>();
  admin.use("*", async (c, next) => {
    if (teamSignIn === "google") {
      const session = await sessionOf(c);
      if (!session) return c.json({ error: "Unauthorized" }, 401);
      const { email, name, image, emailVerified } = session.user;
      if (!isTeamEmail(email, emailVerified)) {
        const listed = config.auth.adminEmails.includes(email.toLowerCase());
        return c.json({ error: listed ? "Team members must sign in with Google. Sign out, then use Sign in with Google." : `${email} isn't on the team list. Ask a teammate to add it to ADMIN_EMAILS.` }, 403);
      }
      c.set("member", { email, name, image: image ?? null });
    } else {
      const token = c.req.header("authorization")?.replace(/^Bearer\s+/i, "");
      if (token !== config.adminToken) return c.json({ error: "Unauthorized" }, 401);
      c.set("member", null);
    }
    await next();
  });

  admin.get("/me", (c) => c.json({ sign_in: teamSignIn, member: c.get("member") }));

  admin.get("/overview", (c) => {
    const n = (sql: string) => get<{ n: number }>(db, sql)!.n;
    return c.json({
      documents: n("SELECT COUNT(*) n FROM documents"),
      needs_review: n("SELECT COUNT(*) n FROM drafts WHERE status='needs_review'"),
      published: n("SELECT COUNT(*) n FROM proposals WHERE published=1"),
      subscribers: n("SELECT COUNT(*) n FROM subscribers WHERE active=1"),
      scheduled: n("SELECT COUNT(*) n FROM notifications WHERE state='scheduled'"),
      uncertain: n("SELECT COUNT(*) n FROM notifications WHERE state='uncertain'"),
      integrations: {
        grok: { enabled: config.grok.enabled, model: config.grok.model },
        elevenlabs: { enabled: config.elevenlabs.enabled, voice: config.elevenlabs.voiceId, model: config.elevenlabs.ttsModel, dub_target: config.elevenlabs.dubbingTarget },
        photon: { enabled: opts.photonEnabled, line_address: config.photon.lineAddress || null, sdk: "spectrum-ts@12.10.1" },
      },
      public_base_url: config.publicBaseUrl,
      show_sample_data: config.showSampleData,
      team_sign_in: { mode: teamSignIn, allowed_emails: teamSignIn === "google" ? config.auth.adminEmails.length : null },
    });
  });

  const docView = (d: DocumentRow) => {
    const drafts = listDrafts(db, d.id);
    return { ...d, file_url: `/media/documents/${d.id}`, drafts: drafts.map((x) => ({ id: x.id, status: x.status, title: JSON.parse(x.data_json).title, extractor: x.extractor, error: x.error, proposal_id: x.proposal_id })) };
  };

  admin.get("/documents", (c) => c.json(all<DocumentRow>(db, "SELECT * FROM documents ORDER BY created_at DESC").map(docView)));

  admin.post("/documents", async (c) => {
    const form = await c.req.parseBody();
    const officialUrl = String(form["official_url"] ?? "").trim();
    const publicationDate = String(form["publication_date"] ?? "").trim() || null;
    const title = String(form["title"] ?? "").trim() || null;
    let bytes: Uint8Array;
    let filename: string;
    let mimeType: string | undefined;
    const file = form["file"];
    if (file instanceof File && file.size > 0) {
      bytes = new Uint8Array(await file.arrayBuffer());
      filename = file.name;
      mimeType = file.type;
    } else {
      if (!officialUrl) throw new HttpError(400, "Choose a file, or enter an official URL to fetch.");
      ({ bytes, filename, mimeType } = await fetchRemote(officialUrl));
    }
    const { document, duplicate } = await importDocument(db, { bytes, filename, mimeType, officialUrl, publicationDate, title });
    let extraction: { draftIds: string[]; extractor: string; note?: string } | null = null;
    let extractionError: string | null = null;
    try {
      extraction = await extractDocument(db, document.id);
    } catch (e) {
      extractionError = (e as Error).message;
    }
    return c.json({ document: docView(document), duplicate, extraction, extraction_error: extractionError });
  });

  admin.get("/documents/:id", (c) => {
    const d = getDocument(db, c.req.param("id"));
    if (!d) throw new HttpError(404, "Not found");
    return c.json({ ...docView(d), pages: getPages(db, d.id) });
  });

  admin.post("/documents/:id/extract", async (c) => {
    const id = c.req.param("id");
    run(db, "DELETE FROM drafts WHERE document_id=? AND status='failed'", id);
    return c.json(await extractDocument(db, id));
  });
  // Manual Grok route: copy this prompt into Grok in Cursor, then paste the reply back.
  admin.get("/documents/:id/grok-prompt", (c) => c.json({ prompt: extractionPrompt(db, c.req.param("id")) }));
  admin.post("/documents/:id/grok-paste", async (c) => {
    const { json, model } = (await c.req.json()) as { json: string; model?: string };
    return c.json(importPastedExtraction(db, c.req.param("id"), String(json ?? ""), model ?? null));
  });

  const draftView = (d: DraftRow) => {
    const doc = getDocument(db, d.document_id)!;
    return {
      ...d,
      data: JSON.parse(d.data_json),
      issues: JSON.parse(d.issues_json),
      document: { ...doc, file_url: `/media/documents/${doc.id}` },
      pages: getPages(db, doc.id),
    };
  };
  admin.get("/drafts", (c) =>
    c.json(
      listDrafts(db).map((d) => {
        const doc = getDocument(db, d.document_id)!;
        return { id: d.id, status: d.status, extractor: d.extractor, title: JSON.parse(d.data_json).title, document_title: doc.title, issues: JSON.parse(d.issues_json).length, proposal_id: d.proposal_id, updated_at: d.updated_at, is_sample: !!doc.is_sample };
      }),
    ),
  );
  admin.get("/drafts/:id", (c) => {
    const d = getDraft(db, c.req.param("id"));
    if (!d) throw new HttpError(404, "Not found");
    const proposals = all<{ id: string; title: string }>(db, "SELECT id, title FROM proposals ORDER BY title");
    return c.json({ draft: draftView(d), proposals, enums: { categories: CATEGORIES, stage_kinds: STAGE_KINDS, event_types: EVENT_TYPES } });
  });
  admin.put("/drafts/:id", async (c) => {
    const body = (await c.req.json()) as { data: unknown; proposal_id?: string | null };
    return c.json(draftView(saveDraft(db, c.req.param("id"), body.data, "proposal_id" in body ? body.proposal_id || null : undefined)));
  });
  admin.post("/drafts/:id/publish", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { proposal_id?: string | null };
    const r = publishDraft(db, c.req.param("id"), { targetProposalId: body.proposal_id || null });
    // Chinese card text: generated translation (labelled in the UI); failures leave English only.
    if (config.grok.enabled && (!r.proposal.title_zh || !r.proposal.summary_zh)) {
      translateCardToChinese(r.proposal.title, r.proposal.summary)
        .then((t) => run(db, "UPDATE proposals SET title_zh=?, summary_zh=? WHERE id=? AND version=?", t.title_zh, t.summary_zh, r.proposal.id, r.proposal.version))
        .catch((e) => console.warn("[grok] translation failed", e.message));
    }
    return c.json({ proposal_id: r.proposal.id, version: r.proposal.version, changes: r.changes, update_drafts: r.updateDrafts });
  });
  admin.post("/drafts/:id/discard", (c) => {
    run(db, "UPDATE drafts SET status='discarded', updated_at=? WHERE id=? AND status != 'published'", nowIso(), c.req.param("id"));
    return c.json({ ok: true });
  });

  admin.get("/proposals", (c) =>
    c.json(
      all<ProposalRow>(db, "SELECT * FROM proposals ORDER BY is_sample, updated_at DESC").map((p) => ({
        ...proposalCard(db, p),
        published: !!p.published,
        version: p.version,
        subscribers: get<{ n: number }>(db, "SELECT COUNT(*) n FROM subscriptions s JOIN subscribers b ON b.id=s.subscriber_id WHERE s.proposal_id=? AND s.active=1 AND b.active=1", p.id)!.n,
      })),
    ),
  );
  admin.post("/proposals/:id/published", async (c) => {
    const { published } = (await c.req.json()) as { published: boolean };
    run(db, "UPDATE proposals SET published=?, updated_at=? WHERE id=?", published ? 1 : 0, nowIso(), c.req.param("id"));
    return c.json({ ok: true });
  });

  /** Development-only: a DEMO meeting whose reminder falls due in N minutes. Clearly labelled in app + message. */
  admin.post("/proposals/:id/demo-event", async (c) => {
    const p = getProposal(db, c.req.param("id"));
    if (!p) throw new HttpError(404, "Not found");
    const { minutes = 1 } = (await c.req.json().catch(() => ({}))) as { minutes?: number };
    // meetings have minute precision, so round up to the next whole minute (reminder lands ≥ N minutes out)
    const raw = Date.now() + config.reminderLeadHours * 3600_000 + Math.max(0.5, Number(minutes)) * 60_000;
    const start = new Date(Math.ceil(raw / 60_000) * 60_000);
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(start);
    const g = (t: string) => parts.find((x) => x.type === t)!.value;
    const date = `${g("year")}-${g("month")}-${g("day")}`;
    const time = `${g("hour")}:${g("minute")}`;
    const now = nowIso();
    const key = `demo_${Date.now()}`;
    run(
      db,
      `INSERT INTO events (id, proposal_id, event_key, type, title, description, date, time, starts_at, location, instructions, cancelled, is_demo, sort_order, version, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,0,1,99,1,?,?)`,
      newId("evt"), p.id, key, "public_hearing", "DEMO test meeting", "Development-only test event — not a real meeting.", date, time, nycToUtcIso(date, time), "DEMO — no real location", "This is a test of the reminder system.", now, now,
    );
    const r = reconcileReminders(db, p.id);
    return c.json({ ok: true, starts_at: nycToUtcIso(date, time), reminders_scheduled: r.scheduled });
  });
  admin.delete("/proposals/:id/demo-events", (c) => {
    run(db, "DELETE FROM events WHERE proposal_id=? AND event_key LIKE 'demo_%'", c.req.param("id"));
    reconcileReminders(db, c.req.param("id"));
    return c.json({ ok: true });
  });

  // audio
  admin.get("/audio", (c) => c.json(audio.audioOverview(db)));
  admin.put("/audio/:id/script", async (c) => {
    const { script, approve } = (await c.req.json()) as { script: string; approve?: boolean };
    audio.saveScript(db, c.req.param("id"), script, !!approve);
    return c.json({ ok: true });
  });
  admin.post("/audio/:id/generate-en", async (c) => {
    await audio.generateEnglish(db, c.req.param("id"));
    return c.json({ ok: true });
  });
  admin.post("/audio/:id/generate-zh", async (c) => {
    const { method } = (await c.req.json().catch(() => ({}))) as { method?: string };
    if (method === "tts_translated") await audio.generateChineseFallback(db, c.req.param("id"));
    else await audio.startChineseDub(db, c.req.param("id"));
    return c.json({ ok: true });
  });
  admin.get("/audio/:id/zh-grok-prompt", (c) => c.json({ prompt: audio.chineseCursorPrompt(db, c.req.param("id")) }));
  admin.post("/audio/:id/zh-grok-paste", async (c) => {
    const { json } = (await c.req.json()) as { json: string };
    await audio.generateChineseFromPasted(db, c.req.param("id"), String(json ?? ""));
    return c.json({ ok: true });
  });
  admin.post("/audio/:id/zh-reset", (c) => {
    audio.resetChinese(db, c.req.param("id"));
    return c.json({ ok: true });
  });
  admin.post("/audio/:id/zh-review", async (c) => {
    const { reviewed } = (await c.req.json()) as { reviewed: boolean };
    audio.setTranslationReview(db, c.req.param("id"), reviewed);
    return c.json({ ok: true });
  });

  // messages
  admin.get("/messages", (c) => {
    const rows = all<NotificationRow & { proposal_title: string | null }>(
      db,
      `SELECT n.*, p.title AS proposal_title FROM notifications n LEFT JOIN proposals p ON p.id = n.proposal_id
       WHERE n.kind != 'reply' ORDER BY CASE n.state WHEN 'uncertain' THEN 0 WHEN 'draft' THEN 1 WHEN 'scheduled' THEN 2 WHEN 'sending' THEN 3 ELSE 4 END, n.due_at DESC LIMIT 300`,
    );
    // group per logical message (same proposal/kind/label/body template) for the outbox view
    const groups = new Map<string, { key: string; label: string; kind: string; proposal_title: string | null; proposal_id: string | null; state: string; due_at: string; recipients: number; ids: string[]; is_demo: boolean; last_error: string | null; body: string }>();
    for (const r of rows) {
      const k = r.kind === "reminder" ? `reminder:${r.event_id}:${r.event_version}:${r.state}` : r.kind === "update" ? `update:${r.proposal_id}:${r.proposal_version}:${r.state}` : r.id;
      const g = groups.get(k);
      if (g) {
        g.recipients++;
        g.ids.push(r.id);
      } else groups.set(k, { key: k, label: r.label, kind: r.kind, proposal_title: r.proposal_title, proposal_id: r.proposal_id, state: r.state, due_at: r.due_at, recipients: 1, ids: [r.id], is_demo: !!r.is_demo, last_error: r.last_error, body: r.body });
    }
    return c.json([...groups.values()]);
  });
  admin.get("/delivery-log", (c) =>
    c.json(
      all<{ handle: string | null } & Record<string, unknown>>(db, "SELECT l.*, s.handle FROM delivery_log l LEFT JOIN subscribers s ON s.id = l.subscriber_id ORDER BY l.id DESC LIMIT 200").map((r) => ({ ...r, handle: r.handle ? maskHandle(r.handle) : null })),
    ),
  );
  const setState = (ids: string[], from: string[], to: string, extra = "") => {
    const ph = ids.map(() => "?").join(",");
    const fromPh = from.map(() => "?").join(",");
    return Number(run(db, `UPDATE notifications SET state=?, updated_at=? ${extra} WHERE id IN (${ph}) AND state IN (${fromPh})`, to, nowIso(), ...ids, ...from).changes);
  };
  admin.post("/messages/send", async (c) => {
    const { ids } = (await c.req.json()) as { ids: string[] };
    const n = setState(ids, ["draft"], "scheduled", `, due_at='${nowIso()}'`);
    await runDueNotifications(db);
    return c.json({ scheduled: n });
  });
  admin.post("/messages/cancel", async (c) => {
    const { ids } = (await c.req.json()) as { ids: string[] };
    return c.json({ cancelled: setState(ids, ["draft", "scheduled", "failed", "uncertain"], "cancelled", ", last_error='Cancelled by team'") });
  });
  admin.post("/messages/resolve", async (c) => {
    // uncertain → sent (teammate confirmed receipt on the phone) or → scheduled (confirmed NOT received)
    const { ids, received } = (await c.req.json()) as { ids: string[]; received: boolean };
    const n = received ? setState(ids, ["uncertain"], "sent", ", last_error='Confirmed received by team'") : setState(ids, ["uncertain", "failed"], "scheduled", `, due_at='${nowIso()}'`);
    if (!received) await runDueNotifications(db);
    return c.json({ updated: n });
  });
  admin.post("/messages/test", async (c) => {
    const { subscriber_id, text } = (await c.req.json()) as { subscriber_id: string; text: string };
    const sb = get<SubscriberRow>(db, "SELECT * FROM subscribers WHERE id=?", subscriber_id);
    if (!sb) throw new HttpError(404, "Subscriber not found");
    if (!sb.active) throw new HttpError(409, "This subscriber has opted out (STOP).");
    if (!text?.trim()) throw new HttpError(400, "Message text required");
    queueTestMessage(db, sb.id, `[TEST] ${text.trim()}`);
    await runDueNotifications(db);
    return c.json({ ok: true });
  });

  admin.get("/subscribers", (c) =>
    c.json(
      all<SubscriberRow>(db, "SELECT * FROM subscribers ORDER BY created_at DESC").map((s) => ({
        id: s.id,
        handle: maskHandle(s.handle),
        transport: s.transport,
        preferred_language: s.preferred_language,
        opted_in_at: s.opted_in_at,
        active: !!s.active,
        stopped_at: s.stopped_at,
        subscriptions: all<{ proposal_id: string; title: string; active: number }>(db, "SELECT s.proposal_id, p.title, s.active FROM subscriptions s JOIN proposals p ON p.id=s.proposal_id WHERE s.subscriber_id=?", s.id),
      })),
    ),
  );

  app.route("/api/admin", admin);

  // ------------------------------------------------------------ static web build (production)
  const dist = path.join(config.projectRoot, "dist");
  if (fs.existsSync(dist)) {
    app.get("*", (c) => {
      const url = new URL(c.req.url);
      const fp = path.join(dist, path.normalize(url.pathname).replace(/^(\.\.[/\\])+/, ""));
      if (url.pathname !== "/" && fs.existsSync(fp) && fs.statSync(fp).isFile()) {
        const ext = path.extname(fp);
        const types: Record<string, string> = { ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".woff2": "font/woff2" };
        return new Response(fs.readFileSync(fp), { headers: { "Content-Type": types[ext] ?? "application/octet-stream", "Cache-Control": "public, max-age=31536000, immutable" } });
      }
      return c.html(fs.readFileSync(path.join(dist, "index.html"), "utf8"));
    });
  }
  return app;
}

export { listPublished };
