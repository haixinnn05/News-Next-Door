import { Icon } from "./Icon";
import { api } from "../lib/api";
import { fmtDate } from "../lib/format";
import { useLang, type Key } from "../lib/i18n";
import { useLoad } from "../lib/meta";
import { Link } from "../lib/router";
import type { ZapFeed, ZapPublicStatus } from "../lib/types";

const STATUS_KEY: Record<ZapPublicStatus, Key> = {
  Filed: "statusFiled",
  "In Public Review": "statusReview",
  Noticed: "statusNoticed",
};

const STATUS_CLASS: Record<ZapPublicStatus, string> = {
  Filed: "filed",
  "In Public Review": "review",
  Noticed: "noticed",
};

export function LiveApplications({
  boardId,
  boardName,
  query = "",
  source,
  hovered,
  onHover,
}: {
  boardId: string;
  boardName: string;
  query?: string;
  source?: { data: ZapFeed | null; error: string | null; loading: boolean };
  hovered?: string | null;
  onHover?: (id: string | null) => void;
}) {
  const { t, lang } = useLang();
  const own = useLoad(() => api.applications(boardId), [boardId]);
  const feed = source ?? own;
  const fresh = feed.data?.source.board_id === boardId ? feed.data : null;
  const q = query.trim().toLowerCase();
  const apps = (fresh?.applications ?? []).filter((a) => {
    if (!q) return true;
    return [a.name, a.brief, a.applicant, a.ulurp_numbers, a.districts, a.location?.label].some((v) => v?.toLowerCase().includes(q));
  });

  return (
    <section className="live-apps" id="live">
      <div className="section-head">
        <h2>{lang === "zh" ? `${boardName}的现行申请` : `Live applications in ${boardName}`}</h2>
        {fresh && (
          <a className="row small" style={{ gap: 6, color: "var(--ink-2)" }} href={fresh.source.dataset_url} target="_blank" rel="noreferrer">
            NYC Open Data <Icon name="external" size={14} />
          </a>
        )}
      </div>
      <p className="muted" style={{ margin: "-6px 0 14px" }}>
        {t("liveLede")}
      </p>
      {feed.loading && !fresh && [0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 92, marginBottom: 10 }} />)}
      {feed.error && !fresh && <div className="banner red">{feed.error}</div>}
      {fresh && apps.length === 0 && (
        <div className="state-box">
          <h3>{t("liveEmpty")}</h3>
        </div>
      )}
      <div className="live-list">
        {apps.map((a) => (
          <Link
            key={a.id}
            className={`live-card${hovered === a.id ? " hover" : ""}`}
            to={`/a/${a.id}`}
            onMouseEnter={() => onHover?.(a.id)}
            onMouseLeave={() => onHover?.(null)}
          >
            <div className="live-card-top">
              <span className={`chip ${STATUS_CLASS[a.public_status]}`}>{t(STATUS_KEY[a.public_status])}</span>
              {a.ulurp_numbers && <span className="subtle small">{a.ulurp_numbers}</span>}
              <span className="icon-btn" aria-hidden="true">
                <Icon name="chevronRight" size={15} />
              </span>
            </div>
            <h3>{a.name}</h3>
            {a.brief && <p>{a.brief}</p>}
            <div className="live-meta">
              {a.location && <span>{a.location.label}</span>}
              <span>{a.districts}</span>
              {a.applicant && (
                <span>
                  {t("applicant")}: {a.applicant}
                </span>
              )}
              {a.milestone && (
                <span>
                  {t("latestMilestone")}
                  {a.milestone_date ? ` · ${fmtDate(a.milestone_date, lang)}` : ""}: {a.milestone}
                </span>
              )}
            </div>
            <span className="link xs">{t("viewDetails")}</span>
          </Link>
        ))}
      </div>
      {fresh && <p className="xs subtle" style={{ marginTop: 12 }}>{t("liveSource")}</p>}
    </section>
  );
}
