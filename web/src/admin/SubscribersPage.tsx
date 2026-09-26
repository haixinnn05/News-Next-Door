import { adminRequest } from "../lib/api";
import { fmtDateTimeShort, fmtRelative } from "../lib/format";
import { Icon } from "../components/Icon";
import type { Subscriber } from "./types";
import { Empty, ErrorBanner, PageHead, SkeletonRows, useLoad } from "./ui";

export function SubscribersPage() {
  return (
    <div className="adm-page">
      <PageHead title="Subscribers" subtitle="Residents who opted in to reminders by texting a follow code." />
      <SubscribersTable />
    </div>
  );
}

/** Shared by the Subscribers page and the Message Delivery “Subscribers” tab. */
export function SubscribersTable() {
  const subs = useLoad(() => adminRequest<Subscriber[]>("/subscribers"));
  const active = subs.data?.filter((s) => s.active).length ?? 0;

  return (
    <>
      <div className="banner info adm-mb">
        <Icon name="shield" size={16} />
        <div>
          Phone numbers are masked. Opt-in happens only when a resident texts a follow code from a proposal page; texting STOP opts them out of everything. We never add anyone manually.
        </div>
      </div>
      <ErrorBanner error={subs.error} onRetry={subs.reload} />
      {!subs.data && subs.loading ? (
        <SkeletonRows n={4} />
      ) : subs.data && subs.data.length === 0 ? (
        <Empty icon="users" title="No subscribers yet">
          When a resident texts a follow code, they’ll appear here.
        </Empty>
      ) : (
        subs.data && (
          <>
            <div className="adm-stat-line subtle small">
              {active} active · {subs.data.length - active} opted out
            </div>
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Handle</th>
                    <th>Transport</th>
                    <th>Language</th>
                    <th>Following</th>
                    <th>Opted in</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {subs.data.map((s) => (
                    <tr key={s.id}>
                      <td className="adm-mono small nowrap">{s.handle}</td>
                      <td>
                        <span className={`pill ${s.transport === "photon" ? "blue" : "grey"}`}>{s.transport === "photon" ? "Photon" : "Simulator"}</span>
                      </td>
                      <td className="small">{s.preferred_language === "zh" ? "中文 Chinese" : "English"}</td>
                      <td>
                        {s.subscriptions.length === 0 ? (
                          <span className="subtle small">—</span>
                        ) : (
                          <div className="adm-follow-list">
                            {s.subscriptions.map((f) => (
                              <a key={f.proposal_id} href={`/p/${f.proposal_id}`} target="_blank" rel="noreferrer" className={`adm-follow${f.active ? "" : " off"}`} title={f.active ? "Following" : "Unfollowed"}>
                                {f.title}
                              </a>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="small nowrap" title={fmtDateTimeShort(s.opted_in_at)}>
                        {fmtRelative(s.opted_in_at)}
                      </td>
                      <td>
                        {s.active ? (
                          <span className="pill green">Active</span>
                        ) : (
                          <span className="pill grey" title={s.stopped_at ? `STOP received ${fmtDateTimeShort(s.stopped_at)}` : undefined}>
                            Opted out
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )
      )}
    </>
  );
}
