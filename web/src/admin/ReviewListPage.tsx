import { useState } from "react";
import { adminJson, adminRequest } from "../lib/api";
import { fmtDateTimeShort, fmtRelative } from "../lib/format";
import { Link, useRouter } from "../lib/router";
import { Icon } from "../components/Icon";
import type { AdminProposal, DraftListItem, DraftStatus } from "./types";
import { DraftPill, Empty, ErrorBanner, PageHead, SkeletonRows, Spinner, useAction, useAdmin, useLoad } from "./ui";

const FILTERS: { id: "all" | DraftStatus; label: string }[] = [
  { id: "all", label: "All" },
  { id: "needs_review", label: "Needs Review" },
  { id: "published", label: "Published" },
  { id: "failed", label: "Failed" },
  { id: "discarded", label: "Discarded" },
];

export function ReviewListPage() {
  const { navigate } = useRouter();
  const { toast } = useAdmin();
  const drafts = useLoad(() => adminRequest<DraftListItem[]>("/drafts"));
  const proposals = useLoad(() => adminRequest<AdminProposal[]>("/proposals"));
  const act = useAction();
  const [filter, setFilter] = useState<"all" | DraftStatus>("all");

  const count = (s: DraftStatus) => drafts.data?.filter((d) => d.status === s).length ?? 0;
  const shown = drafts.data?.filter((d) => filter === "all" || d.status === filter) ?? [];

  const togglePublished = async (p: AdminProposal) => {
    const ok = await act.run(`pub:${p.id}`, () => adminJson("POST", `/proposals/${p.id}/published`, { published: !p.published }));
    if (ok) {
      toast(p.published ? "Unpublished — hidden from the public site." : "Published — visible on the public site.");
      void proposals.reload();
    }
  };
  const demo = async (p: AdminProposal) => {
    const r = await act.run(`demo:${p.id}`, () => adminJson<{ ok: boolean; starts_at: string; reminders_scheduled: number }>("POST", `/proposals/${p.id}/demo-event`, { minutes: 1 }));
    if (r) {
      toast(`DEMO meeting created. ${r.reminders_scheduled} reminder(s) will send in about a minute.`);
      void proposals.reload();
    }
  };
  const clearDemo = async (p: AdminProposal) => {
    const r = await act.run(`undemo:${p.id}`, () => adminJson("DELETE", `/proposals/${p.id}/demo-events`));
    if (r) {
      toast("DEMO events removed and pending DEMO reminders reconciled.");
      void proposals.reload();
    }
  };

  return (
    <div className="adm-page">
      <PageHead
        title="Review proposals"
        subtitle="Check extracted drafts against their source before anything reaches residents."
        right={
          <Link to="/admin/import" className="btn primary">
            <Icon name="upload" size={15} /> Import document
          </Link>
        }
      />

      <div className="filter-chips adm-mb">
        {FILTERS.map((f) => (
          <button key={f.id} className={`filter-chip${filter === f.id ? " on" : ""}`} onClick={() => setFilter(f.id)}>
            {f.label}
            {f.id !== "all" && drafts.data ? ` · ${count(f.id)}` : ""}
          </button>
        ))}
      </div>

      <ErrorBanner error={drafts.error} onRetry={drafts.reload} />
      {!drafts.data && drafts.loading ? (
        <SkeletonRows n={5} />
      ) : shown.length === 0 ? (
        <Empty icon="list" title={filter === "all" ? "No drafts yet" : "Nothing here"}>
          {filter === "all" ? "Import a document to create drafts for review." : "No drafts with this status."}
        </Empty>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table hover">
            <thead>
              <tr>
                <th>Title</th>
                <th>Source document</th>
                <th>Extractor</th>
                <th>Status</th>
                <th className="num">Issues</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((d) => (
                <tr key={d.id} className="clickable" onClick={() => navigate(`/admin/review/${d.id}`)}>
                  <td>
                    <Link to={`/admin/review/${d.id}`} className="adm-cell-title" onClick={(e) => e.stopPropagation()}>
                      {d.title || <span className="subtle">Untitled draft</span>}
                    </Link>
                    {d.is_sample && (
                      <>
                        {" "}
                        <span className="chip sample">Sample</span>
                      </>
                    )}
                  </td>
                  <td className="muted small">{d.document_title}</td>
                  <td>
                    <span className="adm-tag">{d.extractor}</span>
                  </td>
                  <td>
                    <DraftPill status={d.status} />
                  </td>
                  <td className="num">{d.issues > 0 ? <span className="adm-issue-count">{d.issues}</span> : <span className="subtle">0</span>}</td>
                  <td className="subtle small nowrap" title={fmtDateTimeShort(d.updated_at)}>
                    {fmtRelative(d.updated_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section className="adm-section">
        <div className="adm-section-head">
          <div>
            <h2>Proposals</h2>
            <p className="subtle small">Everything that has been published at least once. Unpublishing hides a proposal from the public site but keeps subscribers.</p>
          </div>
        </div>
        <ErrorBanner error={act.error} />
        <ErrorBanner error={proposals.error} onRetry={proposals.reload} />
        {!proposals.data && proposals.loading ? (
          <SkeletonRows n={3} />
        ) : proposals.data && proposals.data.length === 0 ? (
          <Empty icon="doc" title="No proposals yet">
            Publish a reviewed draft to create one.
          </Empty>
        ) : (
          proposals.data && (
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Proposal</th>
                    <th className="num">Version</th>
                    <th className="num">Subscribers</th>
                    <th>Published</th>
                    <th className="right">Reminder test</th>
                  </tr>
                </thead>
                <tbody>
                  {proposals.data.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div className="adm-cell-title">
                          {p.title} {p.is_sample && <span className="chip sample">Sample</span>}
                        </div>
                        <div className="subtle xs row" style={{ gap: 10 }}>
                          <span>{p.location_text ?? "No location listed"}</span>
                          <a href={`/p/${p.id}`} target="_blank" rel="noreferrer" className="link">
                            Public page <Icon name="external" size={11} style={{ display: "inline" }} />
                          </a>
                        </div>
                        {p.next_event?.is_demo && <span className="chip demo adm-mt-xs">DEMO event active</span>}
                      </td>
                      <td className="num">v{p.version}</td>
                      <td className="num">{p.subscribers}</td>
                      <td>
                        <label className="adm-switch" title={p.published ? "Visible on the public site" : "Hidden from the public site"}>
                          <input type="checkbox" checked={p.published} disabled={act.busy === `pub:${p.id}`} onChange={() => void togglePublished(p)} />
                          <span className="track" />
                          <span className="small">{p.published ? "Published" : "Hidden"}</span>
                        </label>
                      </td>
                      <td className="right">
                        <div className="adm-actions">
                          <button
                            className="btn sm"
                            disabled={!!act.busy}
                            onClick={() => void demo(p)}
                            title="Adds a clearly labelled DEMO meeting to this proposal, timed so its reminder falls due in about 1 minute. Subscribers to this proposal receive a message marked DEMO. Development only."
                          >
                            {act.busy === `demo:${p.id}` ? <Spinner /> : <Icon name="bell" size={14} />} Create DEMO reminder test
                          </button>
                          <button className="btn sm ghost" disabled={!!act.busy} onClick={() => void clearDemo(p)} title="Delete all DEMO events for this proposal">
                            {act.busy === `undemo:${p.id}` ? <Spinner /> : <Icon name="x" size={14} />} Remove DEMO events
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="subtle xs adm-table-note">
                <Icon name="info" size={12} style={{ display: "inline", verticalAlign: "-2px" }} /> “Create DEMO reminder test” adds a DEMO meeting whose reminder fires in ~1 minute, so you can
                verify delivery end-to-end. It is labelled DEMO in the app and in the message. Remove it when you’re done.
              </p>
            </div>
          )
        )}
      </section>
    </div>
  );
}
