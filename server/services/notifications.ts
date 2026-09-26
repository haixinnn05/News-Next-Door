import { config } from "../config.ts";
import { all, get, run, tx, type Db } from "../db.ts";
import { newId, nowIso } from "../lib/util.ts";
import { confirmationText, reminderText, updateText } from "./messages.ts";
import { eventTiming, getEvents, getProposal, MEETING_TYPES, nextEvent, type EventRow, type ProposalRow, type PublishChange } from "./proposals.ts";
import { transportFor } from "./transport.ts";

export interface SubscriberRow {
  id: string;
  handle: string;
  space_id: string | null;
  transport: string;
  preferred_language: "en" | "zh";
  opted_in_at: string;
  active: number;
  stopped_at: string | null;
  created_at: string;
}
export interface SubscriptionRow {
  id: string;
  subscriber_id: string;
  proposal_id: string;
  active: number;
  created_at: string;
}
export interface NotificationRow {
  id: string;
  delivery_key: string;
  kind: string;
  subscriber_id: string;
  subscription_id: string | null;
  proposal_id: string | null;
  event_id: string | null;
  event_version: number | null;
  proposal_version: number | null;
  label: string;
  body: string;
  due_at: string;
  state: string;
  attempts: number;
  provider_message_id: string | null;
  last_error: string | null;
  sent_at: string | null;
  is_demo: number;
  created_at: string;
  updated_at: string;
}

const LEAD_MS = () => config.reminderLeadHours * 3600_000;

export function primarySourceUrl(db: Db, proposalId: string): string | null {
  const url =
    get<{ official_url: string }>(
      db,
      "SELECT d.official_url FROM documents d JOIN proposal_documents pd ON pd.document_id = d.id WHERE pd.proposal_id = ? ORDER BY d.publication_date DESC, d.created_at DESC LIMIT 1",
      proposalId,
    )?.official_url ?? null;
  return url?.startsWith("/") ? `${config.publicBaseUrl}${url}` : url;
}

function insertNotification(db: Db, n: Omit<NotificationRow, "id" | "attempts" | "provider_message_id" | "last_error" | "sent_at" | "created_at" | "updated_at">): boolean {
  const now = nowIso();
  const r = run(
    db,
    `INSERT OR IGNORE INTO notifications (id, delivery_key, kind, subscriber_id, subscription_id, proposal_id, event_id, event_version, proposal_version, label, body, due_at, state, is_demo, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    newId("ntf"), n.delivery_key, n.kind, n.subscriber_id, n.subscription_id, n.proposal_id, n.event_id, n.event_version, n.proposal_version, n.label, n.body, n.due_at, n.state, n.is_demo, now, now,
  );
  return Number(r.changes) > 0;
}

function reminderEligible(e: EventRow, now = Date.now()): boolean {
  return MEETING_TYPES.has(e.type) && !!e.starts_at && !e.cancelled && Date.parse(e.starts_at) > now;
}

/** Ensure every active subscription has exactly one reminder per current meeting version; cancel stale ones. */
export function reconcileReminders(db: Db, proposalId: string): { scheduled: number; cancelled: number } {
  const p = getProposal(db, proposalId);
  if (!p) return { scheduled: 0, cancelled: 0 };
  const events = getEvents(db, proposalId);
  const byId = new Map(events.map((e) => [e.id, e]));
  let cancelled = 0;
  let scheduled = 0;
  const now = Date.now();
  tx(db, () => {
    for (const n of all<NotificationRow>(db, "SELECT * FROM notifications WHERE proposal_id = ? AND kind = 'reminder' AND state IN ('scheduled','draft')", proposalId)) {
      const e = n.event_id ? byId.get(n.event_id) : undefined;
      if (!e || e.cancelled || e.version !== n.event_version || !reminderEligible(e, now)) {
        run(db, "UPDATE notifications SET state='cancelled', last_error=?, updated_at=? WHERE id=?", e?.cancelled ? "Event cancelled" : "Event changed (superseded)", nowIso(), n.id);
        cancelled++;
      }
    }
    const subs = all<SubscriptionRow & { lang: "en" | "zh" }>(
      db,
      "SELECT s.*, sb.preferred_language AS lang FROM subscriptions s JOIN subscribers sb ON sb.id = s.subscriber_id WHERE s.proposal_id = ? AND s.active = 1 AND sb.active = 1",
      proposalId,
    );
    const source = primarySourceUrl(db, proposalId);
    for (const s of subs) {
      for (const e of events) {
        if (!reminderEligible(e, now)) continue;
        const due = Date.parse(e.starts_at!) - LEAD_MS();
        if (due <= now) continue; // too late for a reminder; the confirmation already carries the details
        const ok = insertNotification(db, {
          delivery_key: `reminder:${s.id}:${e.id}:v${e.version}`,
          kind: "reminder",
          subscriber_id: s.subscriber_id,
          subscription_id: s.id,
          proposal_id: proposalId,
          event_id: e.id,
          event_version: e.version,
          proposal_version: p.version,
          label: `Reminder: ${e.title}`,
          body: reminderText(p, e, source, s.lang),
          due_at: new Date(due).toISOString(),
          state: "scheduled",
          is_demo: p.is_sample || e.is_demo ? 1 : 0,
        });
        if (ok) scheduled++;
      }
    }
  });
  return { scheduled, cancelled };
}

/** Called after a subscription becomes active: queue the confirmation (sent now) and any reminders. */
export function onSubscribed(db: Db, sub: SubscriptionRow, subscriber: SubscriberRow, confirmKey: string): void {
  const p = getProposal(db, sub.proposal_id)!;
  const events = getEvents(db, p.id);
  const next = nextEvent(events);
  const reminderFor = events
    .filter((e) => reminderEligible(e) && Date.parse(e.starts_at!) - LEAD_MS() > Date.now())
    .sort((a, b) => a.starts_at!.localeCompare(b.starts_at!))[0];
  insertNotification(db, {
    delivery_key: `confirm:${sub.id}:${confirmKey}`,
    kind: "confirmation",
    subscriber_id: subscriber.id,
    subscription_id: sub.id,
    proposal_id: p.id,
    event_id: next?.id ?? null,
    event_version: next?.version ?? null,
    proposal_version: p.version,
    label: "Follow confirmation",
    body: confirmationText(p, next, reminderFor, primarySourceUrl(db, p.id), subscriber.preferred_language),
    due_at: nowIso(),
    state: "scheduled",
    is_demo: p.is_sample ? 1 : 0,
  });
  reconcileReminders(db, p.id);
}

/** After publishing: reschedule reminders; for material changes queue update messages as DRAFTS held for team review. */
export function onProposalPublished(db: Db, p: ProposalRow, changes: PublishChange[], isUpdate: boolean): number {
  reconcileReminders(db, p.id);
  if (!isUpdate || changes.length === 0) return 0;
  const subs = all<SubscriptionRow & { lang: "en" | "zh" }>(
    db,
    "SELECT s.*, sb.preferred_language AS lang FROM subscriptions s JOIN subscribers sb ON sb.id = s.subscriber_id WHERE s.proposal_id = ? AND s.active = 1 AND sb.active = 1",
    p.id,
  );
  const source = primarySourceUrl(db, p.id);
  const label = changes.find((c) => c.kind === "rescheduled") ? "Meeting rescheduled" : changes.find((c) => c.kind === "cancelled") ? "Meeting cancelled" : changes.find((c) => c.kind === "new_event") ? "New meeting announced" : "Proposal updated";
  let n = 0;
  for (const s of subs) {
    if (
      insertNotification(db, {
        delivery_key: `update:${s.id}:v${p.version}`,
        kind: "update",
        subscriber_id: s.subscriber_id,
        subscription_id: s.id,
        proposal_id: p.id,
        event_id: null,
        event_version: null,
        proposal_version: p.version,
        label,
        body: updateText(p, changes.map((c) => c.message), source, s.lang),
        due_at: nowIso(),
        state: "draft",
        is_demo: p.is_sample ? 1 : 0,
      })
    )
      n++;
  }
  return n;
}

/** One-off reply (STOP acknowledgement, help, expired code) — goes through the same logged outbound path. */
export function queueReply(db: Db, subscriberId: string, text: string, key: string): void {
  insertNotification(db, {
    delivery_key: `reply:${key}`,
    kind: "reply",
    subscriber_id: subscriberId,
    subscription_id: null,
    proposal_id: null,
    event_id: null,
    event_version: null,
    proposal_version: null,
    label: "Auto-reply",
    body: text,
    due_at: nowIso(),
    state: "scheduled",
    is_demo: 0,
  });
}

export function queueTestMessage(db: Db, subscriberId: string, text: string): string {
  const key = `test:${newId("t")}`;
  insertNotification(db, {
    delivery_key: key,
    kind: "test",
    subscriber_id: subscriberId,
    subscription_id: null,
    proposal_id: null,
    event_id: null,
    event_version: null,
    proposal_version: null,
    label: "Test message",
    body: text,
    due_at: nowIso(),
    state: "scheduled",
    is_demo: 1,
  });
  return key;
}

/** Cancel everything queued for a subscriber (STOP). */
export function cancelQueuedFor(db: Db, subscriberId: string): number {
  const r = run(db, "UPDATE notifications SET state='cancelled', last_error='Subscriber replied STOP', updated_at=? WHERE subscriber_id=? AND state IN ('scheduled','draft') AND kind != 'reply'", nowIso(), subscriberId);
  return Number(r.changes);
}

// ---------------------------------------------------------------- worker

function stillValid(db: Db, n: NotificationRow): string | null {
  if (n.kind === "reply") return null;
  const sb = get<SubscriberRow>(db, "SELECT * FROM subscribers WHERE id = ?", n.subscriber_id);
  if (!sb || !sb.active) return "Subscriber is no longer active";
  if (n.kind === "test") return null;
  if (n.subscription_id) {
    const s = get<SubscriptionRow>(db, "SELECT * FROM subscriptions WHERE id = ?", n.subscription_id);
    if (!s || !s.active) return "Subscription is no longer active";
  }
  if (n.proposal_id) {
    const p = getProposal(db, n.proposal_id);
    if (!p || !p.published) return "Proposal is unpublished";
  }
  if (n.kind === "reminder") {
    const e = get<EventRow>(db, "SELECT * FROM events WHERE id = ?", n.event_id ?? "");
    if (!e) return "Event removed";
    if (e.cancelled) return "Event cancelled";
    if (e.version !== n.event_version) return "Event changed (superseded)";
    if (eventTiming(e) !== "upcoming") return "Event already started";
  }
  return null;
}

function logDelivery(db: Db, n: NotificationRow, transport: string, outcome: string, detail: string | null) {
  run(db, "INSERT INTO delivery_log (notification_id, direction, transport, subscriber_id, text, outcome, detail, at) VALUES (?,?,?,?,?,?,?,?)", n.id, "outbound", transport, n.subscriber_id, n.body, outcome, detail, nowIso());
}

export async function deliver(db: Db, n: NotificationRow): Promise<void> {
  // claim atomically so two ticks (or a restart) can never send the same row twice
  const claimed = run(db, "UPDATE notifications SET state='sending', attempts=attempts+1, updated_at=? WHERE id=? AND state='scheduled'", nowIso(), n.id);
  if (Number(claimed.changes) === 0) return;
  const invalid = stillValid(db, n);
  if (invalid) {
    run(db, "UPDATE notifications SET state='cancelled', last_error=?, updated_at=? WHERE id=?", invalid, nowIso(), n.id);
    return;
  }
  const sb = get<SubscriberRow>(db, "SELECT * FROM subscribers WHERE id = ?", n.subscriber_id)!;
  let transportName = sb.transport;
  try {
    const t = transportFor(db, sb);
    transportName = t.name;
    const { providerMessageId } = await t.send(sb, n.body);
    run(db, "UPDATE notifications SET state='sent', provider_message_id=?, sent_at=?, last_error=NULL, updated_at=? WHERE id=?", providerMessageId, nowIso(), nowIso(), n.id);
    logDelivery(db, n, transportName, "sent", providerMessageId);
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    const ambiguous = /timeout|timed out|ECONNRESET|socket hang up|aborted/i.test(msg);
    const attempts = n.attempts + 1;
    if (ambiguous) {
      // We may or may not have delivered — never auto-resend. A teammate reconciles from the admin console.
      run(db, "UPDATE notifications SET state='uncertain', last_error=?, updated_at=? WHERE id=?", msg, nowIso(), n.id);
    } else if (attempts < 3) {
      run(db, "UPDATE notifications SET state='scheduled', due_at=?, last_error=?, updated_at=? WHERE id=?", new Date(Date.now() + 30_000 * attempts).toISOString(), msg, nowIso(), n.id);
    } else {
      run(db, "UPDATE notifications SET state='failed', last_error=?, updated_at=? WHERE id=?", msg, nowIso(), n.id);
    }
    logDelivery(db, n, transportName, "failed", msg);
  }
}

export async function runDueNotifications(db: Db): Promise<number> {
  const due = all<NotificationRow>(db, "SELECT * FROM notifications WHERE state='scheduled' AND due_at <= ? ORDER BY due_at LIMIT 25", nowIso());
  for (const n of due) await deliver(db, n);
  return due.length;
}

/** On restart, anything mid-send is marked uncertain rather than resent. */
export function recoverInFlight(db: Db): number {
  const r = run(db, "UPDATE notifications SET state='uncertain', last_error='Worker restarted during send — confirm on the phone before resending', updated_at=? WHERE state='sending'", nowIso());
  return Number(r.changes);
}
