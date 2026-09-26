/**
 * Acceptance checks from the build plan, exercised against an in-memory database.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { get, run, all, openMemoryDb, type Db } from "./db.ts";
import { excerptAppearsIn } from "./lib/text.ts";
import { nycToUtcIso } from "./lib/util.ts";
import { importDocument, getPages } from "./services/documents.ts";
import { extractionPrompt, importPastedExtraction, validateDraft, type DraftData } from "./services/extraction.ts";
import { publishDraft, getEvents, search } from "./services/proposals.ts";
import { createFollowCode, followStatus, handleInbound } from "./services/subscriptions.ts";
import { recoverInFlight, runDueNotifications, type NotificationRow } from "./services/notifications.ts";

const html = (body: string) => new TextEncoder().encode(`<!doctype html><html><head><title>Test doc</title></head><body><main>${body}</main></body></html>`);
const future = (days: number) => new Date(Date.now() + days * 86400_000).toISOString().slice(0, 10);

async function setup(db: Db, hearingDate = future(10), hearingTime = "19:00") {
  const bytes = html(`<h1>Rezoning at 50-02 Queens Blvd</h1><p>Location: 50-02 Queens Blvd, Woodside.</p><p>Public hearing on ${hearingDate} at 7:00 PM at 43-22 50th St.</p><p>Submit written comments to the board office.</p>`);
  const { document } = await importDocument(db, { bytes, filename: "t.html", officialUrl: "https://www.nyc.gov/doc", publicationDate: "2026-09-01" });
  const pages = getPages(db, document.id);
  const find = (s: string) => pages.find((p) => excerptAppearsIn(s, p.text))!.page;
  const data: DraftData = {
    title: "Rezoning at 50-02 Queens Blvd",
    category: "land_use",
    location_text: "50-02 Queens Blvd, Woodside",
    address_key: "50-02-queens-blvd",
    summary: "A rezoning.",
    purpose: null,
    stage: "Public hearing",
    stage_kind: "public_hearing",
    proposed_by: null,
    body_name: null,
    participation: "Submit written comments to the board office.",
    events: [{ key: "hearing", type: "public_hearing", title: "Public hearing", description: null, date: hearingDate, time: hearingTime, location: "43-22 50th St", meeting_url: null, comment_deadline: null, instructions: null, cancelled: false }],
    evidence: [
      { field: "title", page: find("Rezoning at 50-02"), excerpt: "Rezoning at 50-02 Queens Blvd" },
      { field: "location", page: find("Location: 50-02"), excerpt: "Location: 50-02 Queens Blvd, Woodside." },
      { field: "participation", page: find("Submit written"), excerpt: "Submit written comments to the board office." },
      { field: "event:hearing", page: find("Public hearing on"), excerpt: `Public hearing on ${hearingDate} at 7:00 PM` },
    ],
  };
  const id = "drf_test_" + Math.random().toString(36).slice(2);
  run(db, "INSERT INTO drafts (id, document_id, item_index, status, extractor, data_json, issues_json, created_at, updated_at) VALUES (?,?,0,'needs_review','manual',?,'[]',?,?)", id, document.id, JSON.stringify(data), "x", "x");
  return { document, draftId: id, data, pages };
}

test("excerpts must appear verbatim in the source; missing evidence blocks publishing", async () => {
  const db = openMemoryDb();
  const { document, data, pages, draftId } = await setup(db);
  assert.equal(validateDraft(data, document, pages).filter((i) => i.level === "error").length, 0);
  const bad = { ...data, evidence: data.evidence.map((e) => (e.field === "location" ? { ...e, excerpt: "Location: somewhere invented" } : e)) };
  assert.ok(validateDraft(bad, document, pages).some((i) => i.level === "error" && i.field === "location"));
  const noEvidence = { ...data, evidence: data.evidence.filter((e) => e.field !== "event:hearing") };
  run(db, "UPDATE drafts SET data_json=? WHERE id=?", JSON.stringify(noEvidence), draftId);
  assert.throws(() => publishDraft(db, draftId), /Resolve the flagged issues/);
});

test("publication date reused as an event date is flagged; past events are flagged", async () => {
  const db = openMemoryDb();
  const { document, data, pages } = await setup(db);
  const pub = { ...data, events: [{ ...data.events[0], date: "2026-09-01" }] };
  assert.ok(validateDraft(pub, document, pages).some((i) => /publication date/.test(i.message)));
  assert.ok(validateDraft(pub, document, pages, new Date("2026-09-26T12:00:00Z")).some((i) => /in the past/.test(i.message)));
});

test("re-importing the same document creates no duplicate", async () => {
  const db = openMemoryDb();
  const bytes = html("<h1>Same</h1><p>Exactly the same document text, long enough to pass the readable text check for this test case.</p>");
  const a = await importDocument(db, { bytes, filename: "a.html", officialUrl: "https://www.nyc.gov/a" });
  const b = await importDocument(db, { bytes, filename: "b.html", officialUrl: "https://www.nyc.gov/a" });
  assert.equal(a.document.id, b.document.id);
  assert.equal(b.duplicate, true);
  assert.equal(get<{ n: number }>(db, "SELECT COUNT(*) n FROM documents")!.n, 1);
});

test("follow → confirm → reminder scheduled; repeat is harmless; STOP cancels everything", async () => {
  const db = openMemoryDb();
  const { draftId } = await setup(db);
  const { proposal } = publishDraft(db, draftId);
  const fc = createFollowCode(db, proposal.id, "en");
  assert.equal(followStatus(db, fc.code).status, "waiting");
  const r1 = handleInbound(db, { providerEventId: "m1", handle: "+1 (555) 000-1111", spaceId: null, text: fc.code, transport: "simulator" });
  assert.equal(r1.action, "subscribed");
  assert.equal(followStatus(db, fc.code).status, "confirmed");
  // same provider event twice → ignored; same code in a new message → no duplicate notifications
  assert.equal(handleInbound(db, { providerEventId: "m1", handle: "+15550001111", spaceId: null, text: fc.code, transport: "simulator" }).action, "duplicate");
  handleInbound(db, { providerEventId: "m2", handle: "+15550001111", spaceId: null, text: fc.code.toLowerCase(), transport: "simulator" });
  const ns = all<NotificationRow>(db, "SELECT * FROM notifications WHERE kind IN ('confirmation','reminder')");
  assert.equal(ns.filter((n) => n.kind === "confirmation").length, 1);
  assert.equal(ns.filter((n) => n.kind === "reminder").length, 1);
  const reminder = ns.find((n) => n.kind === "reminder")!;
  const hearing = getEvents(db, proposal.id)[0];
  assert.equal(Date.parse(reminder.due_at), Date.parse(hearing.starts_at!) - 24 * 3600_000);

  await runDueNotifications(db);
  assert.equal(get<NotificationRow>(db, "SELECT * FROM notifications WHERE kind='confirmation'")!.state, "sent");
  const sim = all<{ text: string }>(db, "SELECT text FROM sim_messages WHERE direction='to_phone'");
  assert.ok(sim[0].text.includes("You're following") && sim[0].text.includes("https://www.nyc.gov/doc"));

  handleInbound(db, { providerEventId: "m3", handle: "+15550001111", spaceId: null, text: "STOP", transport: "simulator" });
  assert.equal(get<NotificationRow>(db, "SELECT * FROM notifications WHERE kind='reminder'")!.state, "cancelled");
  assert.equal(get<{ active: number }>(db, "SELECT active FROM subscribers")!.active, 0);
});

test("rescheduling a meeting cancels the old reminder, schedules a new one, and drafts an update for review", async () => {
  const db = openMemoryDb();
  const { draftId, data, document } = await setup(db);
  const { proposal } = publishDraft(db, draftId);
  const fc = createFollowCode(db, proposal.id, "en");
  handleInbound(db, { providerEventId: "x1", handle: "+15550002222", spaceId: null, text: fc.code, transport: "simulator" });

  const newDate = future(14);
  const bytes = html(`<h1>Rezoning at 50-02 Queens Blvd — hearing moved</h1><p>The public hearing is rescheduled to ${newDate} at 7:00 PM.</p>`);
  const { document: doc2 } = await importDocument(db, { bytes, filename: "u.html", officialUrl: "https://www.nyc.gov/doc2" });
  const p2 = getPages(db, doc2.id);
  const upd: DraftData = { ...data, events: [{ ...data.events[0], date: newDate }], evidence: [{ field: "event:hearing", page: p2.find((p) => p.text.includes("rescheduled"))!.page, excerpt: `rescheduled to ${newDate} at 7:00 PM` }], location_text: null, participation: null };
  run(db, "INSERT INTO drafts (id, document_id, item_index, status, extractor, data_json, issues_json, created_at, updated_at) VALUES ('d2',?,0,'needs_review','manual',?,'[]','x','x')", doc2.id, JSON.stringify(upd));
  void document;
  const res = publishDraft(db, "d2", { targetProposalId: proposal.id });
  assert.equal(res.proposal.version, 2);
  assert.ok(res.changes.some((c) => c.kind === "rescheduled"));
  const reminders = all<NotificationRow>(db, "SELECT * FROM notifications WHERE kind='reminder' ORDER BY created_at");
  assert.equal(reminders.length, 2);
  assert.equal(reminders[0].state, "cancelled");
  assert.equal(reminders[1].state, "scheduled");
  assert.equal(Date.parse(reminders[1].due_at), Date.parse(nycToUtcIso(newDate, "19:00")) - 24 * 3600_000);
  const update = get<NotificationRow>(db, "SELECT * FROM notifications WHERE kind='update'")!;
  assert.equal(update.state, "draft"); // held for team review
  // location from the first document is preserved (null in newer doc = not listed there)
  assert.equal(res.proposal.location_text, "50-02 Queens Blvd, Woodside");
});

test("a hearing less than 24h away gets no reminder; the confirmation carries the details", async () => {
  const db = openMemoryDb();
  const soon = new Date(Date.now() + 5 * 3600_000);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(soon);
  const g = (t: string) => parts.find((x) => x.type === t)!.value;
  const { draftId } = await setup(db, `${g("year")}-${g("month")}-${g("day")}`, `${g("hour")}:${g("minute")}`);
  const { proposal } = publishDraft(db, draftId);
  const fc = createFollowCode(db, proposal.id, "en");
  handleInbound(db, { providerEventId: "s1", handle: "+15550003333", spaceId: null, text: fc.code, transport: "simulator" });
  assert.equal(get<{ n: number }>(db, "SELECT COUNT(*) n FROM notifications WHERE kind='reminder'")!.n, 0);
  assert.match(get<NotificationRow>(db, "SELECT * FROM notifications WHERE kind='confirmation'")!.body, /coming up soon/);
});

test("worker restart marks in-flight sends uncertain instead of resending", () => {
  const db = openMemoryDb();
  run(db, "INSERT INTO subscribers (id, handle, transport, opted_in_at, created_at) VALUES ('s','+1','simulator','x','x')");
  run(db, "INSERT INTO notifications (id, delivery_key, kind, subscriber_id, label, body, due_at, state, created_at, updated_at) VALUES ('n','k','test','s','l','b','2020-01-01','sending','x','x')");
  assert.equal(recoverInFlight(db), 1);
  assert.equal(get<NotificationRow>(db, "SELECT * FROM notifications")!.state, "uncertain");
});

test("unknown addresses are reported as unsupported, not matched to unrelated results", async () => {
  const db = openMemoryDb();
  const { draftId } = await setup(db);
  publishDraft(db, draftId);
  assert.equal(search(db, "123 Fake Street").status, "unsupported_address");
  assert.equal(search(db, "50-02 Queens Boulevard").status, "ok");
  assert.equal(search(db, "45-40 Vernon Blvd").status, "no_proposals_at_address");
});

test("Grok via Cursor: a pasted reply gets the same schema and source checks, and never overwrites a published draft", async () => {
  const db = openMemoryDb();
  const { document, data } = await setup(db);
  run(db, "DELETE FROM drafts WHERE document_id=?", document.id);
  assert.match(extractionPrompt(db, document.id), /UNTRUSTED DATA[\s\S]*Public hearing on/);

  const { address_key: _k, ...proposal } = data;
  const reply = "Here you go:\n```json\n" + JSON.stringify({ proposals: [proposal] }) + "\n```";
  const r = importPastedExtraction(db, document.id, reply, "grok-4 in Cursor");
  assert.equal(r.draftIds.length, 1);
  const row = get<{ extractor: string; issues_json: string }>(db, "SELECT extractor, issues_json FROM drafts WHERE id=?", r.draftIds[0])!;
  assert.equal(row.extractor, "grok_cursor");
  assert.equal(JSON.parse(row.issues_json).filter((i: { level: string }) => i.level === "error").length, 0);

  const invented = { ...proposal, evidence: proposal.evidence.map((e) => (e.field === "location" ? { ...e, excerpt: "Location: somewhere invented" } : e)) };
  const r2 = importPastedExtraction(db, document.id, JSON.stringify({ proposals: [invented] }), null);
  assert.ok(JSON.parse(get<{ issues_json: string }>(db, "SELECT issues_json FROM drafts WHERE id=?", r2.draftIds[0])!.issues_json).some((i: { field: string }) => i.field === "location"));

  assert.throws(() => importPastedExtraction(db, document.id, "not json", null), /isn't valid JSON/);
  assert.throws(() => importPastedExtraction(db, document.id, JSON.stringify({ proposals: [{ title: "x" }] }), null), /doesn't match the schema/);

  importPastedExtraction(db, document.id, reply, null);
  run(db, "UPDATE drafts SET status='published' WHERE id=?", r.draftIds[0]);
  importPastedExtraction(db, document.id, JSON.stringify({ proposals: [invented] }), null);
  assert.equal(get<{ data_json: string }>(db, "SELECT data_json FROM drafts WHERE id=?", r.draftIds[0])!.data_json.includes("somewhere invented"), false);
});
