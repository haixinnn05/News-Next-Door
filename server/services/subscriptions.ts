import crypto from "node:crypto";
import { config } from "../config.ts";
import { get, run, tx, type Db } from "../db.ts";
import { HttpError, newId, nowIso } from "../lib/util.ts";
import { EXPIRED_TEXT, HELP_TEXT, STOP_TEXT } from "./messages.ts";
import { cancelQueuedFor, onSubscribed, queueReply, type SubscriberRow, type SubscriptionRow } from "./notifications.ts";
import { getProposal } from "./proposals.ts";
import { onAppSubscribed, snapshotOf, type AppSubscriptionRow } from "./appBriefings.ts";
import type { ZapApplication } from "./zap.ts";

export interface FollowCodeRow {
  code: string;
  proposal_id: string;
  language: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  subscription_id: string | null;
  user_id: string | null;
}

/** A follow code for a live city application; same format and lifetime as proposal codes. */
export interface AppFollowCodeRow {
  code: string;
  project_id: string;
  snapshot_json: string;
  language: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  subscription_id: string | null;
  user_id: string | null;
}

const CODE_RE = /\bQCB2[\s-]?(\d{4})\b/i;

/** A code no live or used follow code holds, in either table. Expired, unused clashes are cleared. */
function freeFollowCode(db: Db, now: number): string {
  for (let i = 0; i < 20; i++) {
    const code = `QCB2-${crypto.randomInt(1000, 10000)}`;
    const clashes = [get<FollowCodeRow>(db, "SELECT * FROM follow_codes WHERE code = ?", code), get<AppFollowCodeRow>(db, "SELECT * FROM app_follow_codes WHERE code = ?", code)];
    if (clashes.some((c) => c && (Date.parse(c.expires_at) > now || c.used_at))) continue;
    run(db, "DELETE FROM follow_codes WHERE code = ?", code);
    run(db, "DELETE FROM app_follow_codes WHERE code = ?", code);
    return code;
  }
  throw new HttpError(503, "Could not allocate a follow code, try again.");
}

export function createFollowCode(db: Db, proposalId: string, language: "en" | "zh", userId: string | null = null): FollowCodeRow {
  const p = getProposal(db, proposalId);
  if (!p || !p.published) throw new HttpError(404, "Proposal not found");
  const now = Date.now();
  const code = freeFollowCode(db, now);
  run(
    db,
    "INSERT INTO follow_codes (code, proposal_id, language, created_at, expires_at, user_id) VALUES (?,?,?,?,?,?)",
    code, proposalId, language, new Date(now).toISOString(), new Date(now + config.followCodeTtlMinutes * 60_000).toISOString(), userId,
  );
  return get<FollowCodeRow>(db, "SELECT * FROM follow_codes WHERE code = ?", code)!;
}

/** The snapshot is what the page showed, so the first update compares against what the resident saw. */
export function createAppFollowCode(db: Db, app: ZapApplication, language: "en" | "zh", userId: string | null = null): AppFollowCodeRow {
  const now = Date.now();
  const code = freeFollowCode(db, now);
  run(
    db,
    "INSERT INTO app_follow_codes (code, project_id, snapshot_json, language, created_at, expires_at, user_id) VALUES (?,?,?,?,?,?,?)",
    code, app.id, JSON.stringify(snapshotOf(app)), language, new Date(now).toISOString(), new Date(now + config.followCodeTtlMinutes * 60_000).toISOString(), userId,
  );
  return get<AppFollowCodeRow>(db, "SELECT * FROM app_follow_codes WHERE code = ?", code)!;
}

export function followStatus(db: Db, code: string): { status: "waiting" | "confirmed" | "expired" | "unknown"; expires_at?: string } {
  const row =
    get<FollowCodeRow>(db, "SELECT * FROM follow_codes WHERE code = ?", code.toUpperCase()) ??
    get<AppFollowCodeRow>(db, "SELECT * FROM app_follow_codes WHERE code = ?", code.toUpperCase());
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
      run(db, "UPDATE app_subscriptions SET active=0 WHERE subscriber_id=?", known.id);
      cancelQueuedFor(db, known.id);
      queueReply(db, known.id, STOP_TEXT, `stop:${ev.providerEventId}`);
    });
    return { action: "stopped" };
  }

  const m = text.match(CODE_RE);
  if (m) {
    const code = `QCB2-${m[1]}`;
    const afc = get<AppFollowCodeRow>(db, "SELECT * FROM app_follow_codes WHERE code = ?", code);
    if (afc && (afc.used_at || Date.parse(afc.expires_at) > Date.now())) return subscribeToApp(db, ev, afc);
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
      // the first phone to text a code requested while signed in is linked to that account
      if (fc.user_id && !fc.used_at) run(db, "UPDATE subscribers SET user_id=? WHERE id=?", fc.user_id, sb.id);
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

function subscribeToApp(db: Db, ev: Inbound, fc: AppFollowCodeRow): { action: string } {
  return tx(db, () => {
    const sb = upsertSubscriber(db, ev, fc.language);
    if (!sb.active) run(db, "UPDATE subscribers SET active=1, stopped_at=NULL, opted_in_at=? WHERE id=?", nowIso(), sb.id);
    if (fc.user_id && !fc.used_at) run(db, "UPDATE subscribers SET user_id=? WHERE id=?", fc.user_id, sb.id);
    let sub = get<AppSubscriptionRow>(db, "SELECT * FROM app_subscriptions WHERE subscriber_id=? AND project_id=?", sb.id, fc.project_id);
    if (!sub) {
      const id = newId("aps");
      run(db, "INSERT INTO app_subscriptions (id, subscriber_id, project_id, snapshot_json, active, created_at) VALUES (?,?,?,?,1,?)", id, sb.id, fc.project_id, fc.snapshot_json, nowIso());
      sub = get<AppSubscriptionRow>(db, "SELECT * FROM app_subscriptions WHERE id=?", id)!;
    } else if (!sub.active) {
      run(db, "UPDATE app_subscriptions SET active=1, snapshot_json=?, checked_at=NULL WHERE id=?", fc.snapshot_json, sub.id);
      sub = get<AppSubscriptionRow>(db, "SELECT * FROM app_subscriptions WHERE id=?", sub.id)!;
    }
    onAppSubscribed(db, sub, get<SubscriberRow>(db, "SELECT * FROM subscribers WHERE id=?", sb.id)!, fc.code);
    if (!fc.used_at) run(db, "UPDATE app_follow_codes SET used_at=?, subscription_id=? WHERE code=?", nowIso(), sub.id, fc.code);
    return { action: "subscribed" };
  });
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
