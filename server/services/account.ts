import { config } from "../config.ts";
import { all, run, type Db } from "../db.ts";
import { HttpError, nowIso } from "../lib/util.ts";
import { getProposal, proposalCard, type ProposalRow } from "./proposals.ts";

const visible = (p: ProposalRow | undefined): p is ProposalRow => !!p && !!p.published && (!p.is_sample || config.showSampleData);

/** A signed-in resident's saved proposals, plus proposals followed by text from phones linked to the account. */
export function myProposals(db: Db, userId: string, maskHandle: (h: string) => string) {
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
  return { saved, following, phones };
}

export function setSaved(db: Db, userId: string, proposalId: string, saved: boolean) {
  if (!visible(getProposal(db, proposalId))) throw new HttpError(404, "Proposal not found");
  if (saved) run(db, "INSERT OR IGNORE INTO saved_proposals (user_id, proposal_id, created_at) VALUES (?,?,?)", userId, proposalId, nowIso());
  else run(db, "DELETE FROM saved_proposals WHERE user_id = ? AND proposal_id = ?", userId, proposalId);
}
