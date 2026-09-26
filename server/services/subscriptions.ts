import crypto from "node:crypto";
import { config } from "../config.ts";
import { get, run, tx, type Db } from "../db.ts";
import { HttpError, newId, nowIso } from "../lib/util.ts";
import { EXPIRED_TEXT, HELP_TEXT, STOP_TEXT } from "./messages.ts";
import { cancelQueuedFor, onSubscribed, queueReply, type SubscriberRow, type SubscriptionRow } from "./notifications.ts";
import { getProposal } from "./proposals.ts";

export interface FollowCodeRow {
  code: string;
  proposal_id: string;
  language: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  subscription_id: string | null;
}

const CODE_RE = /\bQCB2[\s-]?(\d{4})\b/i;

export function createFollowCode(db: Db, proposalId: string, language: "en" | "zh"): FollowCodeRow {
  const p = getProposal(db, proposalId);
  if (!p || !p.published) throw new HttpError(404, "Proposal not found");
  const now = Date.now();
  for (let i = 0; i < 20; i++) {
    const code = `QCB2-${crypto.randomInt(1000, 10000)}`;
    const clash = get<FollowCodeRow>(db, "SELECT * FROM follow_codes WHERE code = ?", code);
    if (clash && (Date.parse(clash.expires_at) > now || clash.used_at)) continue;
    if (clash) run(db, "DELETE FROM follow_codes WHERE code = ?", code);
    run(
      db,
      "INSERT INTO follow_codes (code, proposal_id, language, created_at, expires_at) VALUES (?,?,?,?,?)",
      code, proposalId, language, new Date(now).toISOString(), new Date(now + config.followCodeTtlMinutes * 60_000).toISOString(),
    );
    return get<FollowCodeRow>(db, "SELECT * FROM follow_codes WHERE code = ?", code)!;
  }
  throw new HttpError(503, "Could not allocate a follow code, try again.");
}

export function followStatus(db: Db, code: string): { status: "waiting" | "confirmed" | "expired" | "unknown"; expires_at?: string } {
  const row = get<FollowCodeRow>(db, "SELECT * FROM follow_codes WHERE code = ?", code.toUpperCase());
  if (!row) return { status: "unknown" };
  if (row.used_at) {
    // confirmed only once the confirmation reply has actually been processed by the backend
    return { status: "confirmed" };
  }
  if (Date.parse(row.expires_at) < Date.now()) return { status: "expired" };
  return { status: "waiting", expires_at: row.expires_at };
}

export interface Inbound {
  providerEventId: string;
  handle: string;
  spaceId: string | null;
  text: string;
  transport: "photon" | "simulator";
}

function normalizeHandle(h: string): string {
  const t = h.trim();
  if (t.includes("@")) return t.toLowerCase();
  const digits = t.replace(/[^\d+]/g, "");
  if (/^\d{10}$/.test(digits)) return `+1${digits}`;
  if (/^1\d{10}$/.test(digits)) return `+${digits}`;
  return digits || t;
}

function upsertSubscriber(db: Db, ev: Inbound, language: string): SubscriberRow {
  const handle = normalizeHandle(ev.handle);
  const existing = get<SubscriberRow>(db, "SELECT * FROM subscribers WHERE handle = ?", handle);
  const now = nowIso();
  if (existing) {
    run(db, "UPDATE subscribers SET space_id=COALESCE(?, space_id), transport=?, preferred_language=? WHERE id=?", ev.spaceId, ev.transport, language, existing.id);
    return get<SubscriberRow>(db, "SELECT * FROM subscribers WHERE id = ?", existing.id)!;
  }
  const id = newId("sub");
  run(db, "INSERT INTO subscribers (id, handle, space_id, transport, preferred_language, opted_in_at, active, created_at) VALUES (?,?,?,?,?,?,1,?)", id, handle, ev.spaceId, ev.transport, language, now, now);
  return get<SubscriberRow>(db, "SELECT * FROM subscribers WHERE id = ?", id)!;
}

/**
 * Handle one inbound message. The resident initiating the conversation with a follow code is
 * the opt-in. Idempotent per provider event id, and repeating a follow request is harmless.
 */
export function handleInbound(db: Db, ev: Inbound): { action: string } {
  const seen = run(db, "INSERT OR IGNORE INTO inbound_seen (provider_event_id, at) VALUES (?,?)", ev.providerEventId, nowIso());
  if (Number(seen.changes) === 0) return { action: "duplicate" };
  const text = ev.text.trim();
  const handle = normalizeHandle(ev.handle);
  const known = get<SubscriberRow>(db, "SELECT * FROM subscribers WHERE handle = ?", handle);
  run(db, "INSERT INTO delivery_log (direction, transport, subscriber_id, text, outcome, at) VALUES ('inbound',?,?,?,'received',?)", ev.transport, known?.id ?? null, text, nowIso());

  if (/^(stop|stopall|unsubscribe|cancel|end|quit|退订)$/i.test(text)) {
    if (!known) return { action: "stop_unknown" };
    tx(db, () => {
      run(db, "UPDATE subscribers SET active=0, stopped_at=? WHERE id=?", nowIso(), known.id);
      run(db, "UPDATE subscriptions SET active=0 WHERE subscriber_id=?", known.id);
      cancelQueuedFor(db, known.id);
      queueReply(db, known.id, STOP_TEXT, `stop:${ev.providerEventId}`);
    });
    return { action: "stopped" };
  }

  const m = text.match(CODE_RE);
  if (m) {
    const code = `QCB2-${m[1]}`;
    const fc = get<FollowCodeRow>(db, "SELECT * FROM follow_codes WHERE code = ?", code);
    const valid = fc && (fc.used_at || Date.parse(fc.expires_at) > Date.now());
    if (!fc || !valid) {
      const sb = known ?? upsertSubscriberInactive(db, ev);
      queueReply(db, sb.id, EXPIRED_TEXT, `expired:${ev.providerEventId}`);
      return { action: "expired_code" };
    }
    return tx(db, () => {
      const sb = upsertSubscriber(db, ev, fc.language);
      if (!sb.active) run(db, "UPDATE subscribers SET active=1, stopped_at=NULL, opted_in_at=? WHERE id=?", nowIso(), sb.id);
      let sub = get<SubscriptionRow>(db, "SELECT * FROM subscriptions WHERE subscriber_id=? AND proposal_id=?", sb.id, fc.proposal_id);
      if (!sub) {
        const id = newId("sbs");
        run(db, "INSERT INTO subscriptions (id, subscriber_id, proposal_id, active, created_at) VALUES (?,?,?,1,?)", id, sb.id, fc.proposal_id, nowIso());
        sub = get<SubscriptionRow>(db, "SELECT * FROM subscriptions WHERE id=?", id)!;
      } else if (!sub.active) {
        run(db, "UPDATE subscriptions SET active=1 WHERE id=?", sub.id);
      }
      // one confirmation per code — resending the same code does not produce a second confirmation
      onSubscribed(db, sub, get<SubscriberRow>(db, "SELECT * FROM subscribers WHERE id=?", sb.id)!, code);
      if (!fc.used_at) run(db, "UPDATE follow_codes SET used_at=?, subscription_id=? WHERE code=?", nowIso(), sub.id, code);
      return { action: "subscribed" };
    });
  }

  if (/^(help|info|帮助)$/i.test(text) || known) {
    const sb = known ?? upsertSubscriberInactive(db, ev);
    queueReply(db, sb.id, HELP_TEXT, `help:${ev.providerEventId}`);
    return { action: "help" };
  }
  // unknown sender, not a code: reply once with help so they know how to follow
  const sb = upsertSubscriberInactive(db, ev);
  queueReply(db, sb.id, HELP_TEXT, `help:${ev.providerEventId}`);
  return { action: "help" };
}

/** Record a contact who wrote in without opting in, so we can answer them; they receive no alerts. */
function upsertSubscriberInactive(db: Db, ev: Inbound): SubscriberRow {
  const handle = normalizeHandle(ev.handle);
  const existing = get<SubscriberRow>(db, "SELECT * FROM subscribers WHERE handle = ?", handle);
  if (existing) return existing;
  const id = newId("sub");
  run(db, "INSERT INTO subscribers (id, handle, space_id, transport, preferred_language, opted_in_at, active, created_at) VALUES (?,?,?,?,?,?,0,?)", id, handle, ev.spaceId, ev.transport, "en", nowIso(), nowIso());
  return get<SubscriberRow>(db, "SELECT * FROM subscribers WHERE id = ?", id)!;
}
