import { config } from "../config.ts";
import { all, get, run, type Db } from "../db.ts";
import { HttpError, nowIso } from "../lib/util.ts";
import { getProposal, proposalCard, type ProposalRow } from "./proposals.ts";
import { applicationById, type ZapApplication } from "./zap.ts";

const visible = (p: ProposalRow | undefined): p is ProposalRow => !!p && !!p.published && (!p.is_sample || config.showSampleData);

function snapshotOf(json: string): ZapApplication | null {
  try {
    const app = JSON.parse(json) as ZapApplication;
    if (app && typeof app.id === "string" && typeof app.name === "string" && typeof app.zap_url === "string") return app;
  } catch {
    /* stored card is unreadable */
  }
  return null;
}

/** A signed-in resident's saved proposals, plus proposals followed by text from phones linked to the account. */
export async function myProposals(db: Db, userId: string, maskHandle: (h: string) => string) {
  const now = Date.now();
  const saved = all<ProposalRow>(db, "SELECT p.* FROM saved_proposals s JOIN proposals p ON p.id = s.proposal_id WHERE s.user_id = ? ORDER BY s.created_at DESC", userId)
    .filter(visible)
    .map((p) => proposalCard(db, p, now));
  const following = all<ProposalRow & { handle: string }>(
    db,
    `SELECT p.*, b.handle FROM subscriptions s
       JOIN subscribers b ON b.id = s.subscriber_id
       JOIN proposals p ON p.id = s.proposal_id
     WHERE b.user_id = ? AND b.active = 1 AND s.active = 1
     ORDER BY s.created_at DESC`,
    userId,
  )
    .filter(visible)
    .map((p) => ({ ...proposalCard(db, p, now), phone: maskHandle(p.handle) }));
  const phones = all<{ handle: string }>(db, "SELECT handle FROM subscribers WHERE user_id = ? AND active = 1", userId).map((r) => maskHandle(r.handle));
  const stored = all<{ project_id: string; snapshot_json: string }>(db, "SELECT project_id, snapshot_json FROM saved_applications WHERE user_id = ? ORDER BY created_at DESC", userId);
  const applications: ZapApplication[] = [];
  for (const row of stored) {
    try {
      applications.push(await applicationById(row.project_id, now));
    } catch {
      const snap = snapshotOf(row.snapshot_json);
      if (snap) applications.push(snap);
    }
  }
  return { saved, following, phones, applications };
}

export async function setSaved(db: Db, userId: string, proposalId: string, saved: boolean) {
  if (visible(getProposal(db, proposalId))) {
    if (saved) run(db, "INSERT OR IGNORE INTO saved_proposals (user_id, proposal_id, created_at) VALUES (?,?,?)", userId, proposalId, nowIso());
    else run(db, "DELETE FROM saved_proposals WHERE user_id = ? AND proposal_id = ?", userId, proposalId);
    return;
  }
  const existing = get<{ project_id: string }>(db, "SELECT project_id FROM saved_applications WHERE user_id = ? AND project_id = ?", userId, proposalId);
  if (!saved) {
    if (!existing) throw new HttpError(404, "Proposal not found");
    run(db, "DELETE FROM saved_applications WHERE user_id = ? AND project_id = ?", userId, proposalId);
    return;
  }
  const app = await applicationById(proposalId);
  run(
    db,
    "INSERT INTO saved_applications (user_id, project_id, snapshot_json, created_at) VALUES (?,?,?,?) ON CONFLICT(user_id, project_id) DO UPDATE SET snapshot_json = excluded.snapshot_json",
    userId,
    app.id,
    JSON.stringify(app),
    nowIso(),
  );
}
