import type { ReactNode } from "react";
import { Icon, type IconName } from "../components/Icon";
import { ProposalArt } from "../components/Illustration";
import { useToast } from "../components/Toast";
import { api } from "../lib/api";
import { fmtDate } from "../lib/format";
import { useLang, type Key } from "../lib/i18n";
import { useLoad } from "../lib/meta";
import { Link, useRouter } from "../lib/router";
import type { ZapApplication, ZapPublicStatus } from "../lib/types";
import { SaveButton } from "./Proposal";

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

function GlanceRow({ icon, label, children }: { icon: IconName; label: string; children: ReactNode }) {
  return (
    <div className="g-row">
      <Icon name={icon} size={18} />
      <div>
        <dt>{label}</dt>
        <dd>{children}</dd>
      </div>
    </div>
  );
}

export function ApplicationCard({ a }: { a: ZapApplication }) {
  const { t } = useLang();
  return (
    <Link to={`/a/${a.id}`} className="proposal-card">
      <div className="thumb">
        <ProposalArt category="land_use" seed={a.id} />
      </div>
      <div className="body">
        <div className="top">
          <span className={`chip ${STATUS_CLASS[a.public_status]}`}>{t(STATUS_KEY[a.public_status])}</span>
        </div>
        <h3>{a.name}</h3>
        <div className="addr">{a.location?.label ?? a.districts}</div>
      </div>
    </Link>
  );
}

export function ApplicationPage({ id }: { id: string }) {
  const { t, lang } = useLang();
  const { navigate } = useRouter();
  const toast = useToast();
  const res = useLoad(() => api.application(id), [id]);
  const a = res.data;

  if (res.loading && !a)
    return (
      <div className="container page">
        <div className="skeleton" style={{ height: 40, width: 320 }} />
        <div className="skeleton" style={{ height: 420, marginTop: 24 }} />
      </div>
    );
  if (res.error || !a)
    return (
      <div className="container page">
        <div className="state-box">
          <h3>{lang === "zh" ? "找不到此申请" : "Application not found"}</h3>
          <p>{res.error}</p>
          <Link to="/discover" className="btn sm">
            {t("backToResults")}
          </Link>
        </div>
      </div>
    );

  const share = async () => {
    const url = location.origin + `/a/${a.id}`;
    if (navigator.share) navigator.share({ title: a.name, url }).catch(() => {});
    else {
      await navigator.clipboard?.writeText(url);
      toast(lang === "zh" ? "链接已复制" : "Link copied");
    }
  };
  const when = (date: string | null) => (date ? fmtDate(date, lang) : t("notListed"));

  return (
    <div className="container page" style={{ paddingTop: 20 }}>
      <div className="row between">
        <Link to="/discover" className="back-link">
          <Icon name="arrowLeft" size={16} /> {t("backToResults")}
        </Link>
        <div className="row" style={{ gap: 10 }}>
          <button className="btn sm" onClick={() => void share()}>
            <Icon name="share" size={15} /> {t("share")}
          </button>
          <SaveButton proposalId={a.id} />
        </div>
      </div>

      <div className="p-head">
        <div>
          <span className={`chip ${STATUS_CLASS[a.public_status]}`}>{t(STATUS_KEY[a.public_status])}</span>
          <h1>{a.name}</h1>
          <div className="addr">{a.location?.label ?? a.districts}</div>
        </div>
      </div>

      <div className="overview" style={{ marginTop: 22 }}>
        <div>
          <div className="figure">
            <ProposalArt category="land_use" seed={a.id} title={lang === "zh" ? "插图（非现场照片）" : "Illustration (not a photo of the site)"} />
          </div>
          <p className="xs subtle" style={{ margin: "6px 2px 0" }}>
            {lang === "zh" ? "插图，非现场照片。" : "Illustration — not a photo of the site."}
          </p>
          <h2>{t("whatIsProposed")}</h2>
          <p>{a.brief ?? <span className="not-listed">{t("notListed")}</span>}</p>
          {a.actions.length > 0 && (
            <>
              <h2 style={{ fontSize: 16 }}>{t("actionsRequested")}</h2>
              <p>{[...new Set(a.actions.map((action) => action.label))].join(" · ")}</p>
            </>
          )}
          <p className="xs subtle" style={{ marginTop: 18 }}>
            {t("appLede")}
          </p>
          <div className="source-list" style={{ marginTop: 14 }}>
            <div className="source-item">
              <div className="ic">ZAP</div>
              <div>
                <div style={{ fontWeight: 600 }}>{a.name}</div>
                <div className="small subtle">{a.districts}{a.ulurp_numbers ? ` · ${a.ulurp_numbers}` : ""}</div>
              </div>
              <a className="btn sm primary" href={a.zap_url} target="_blank" rel="noreferrer">
                {t("openRecord")} <Icon name="external" size={13} />
              </a>
            </div>
          </div>
        </div>
        <aside className="panel glance">
          <h3>{t("atAGlance")}</h3>
          <dl>
            <GlanceRow icon="flag" label={t("stage")}>
              {t(STATUS_KEY[a.public_status])}
            </GlanceRow>
            <GlanceRow icon="calendar" label={t("latestMilestone")}>
              {a.milestone ? (
                <>
                  {a.milestone}
                  {a.milestone_date && <div className="xs subtle" style={{ fontWeight: 500 }}>{fmtDate(a.milestone_date, lang)}</div>}
                </>
              ) : (
                t("notListed")
              )}
            </GlanceRow>
            <GlanceRow icon="pin" label={t("location")}>
              {a.location?.label ?? a.districts}
            </GlanceRow>
            <GlanceRow icon="user" label={t("applicant")}>
              {a.applicant ?? t("notListed")}
              {a.applicant_type && <div className="xs subtle" style={{ fontWeight: 500 }}>{a.applicant_type}</div>}
            </GlanceRow>
            <GlanceRow icon="building" label={t("councilDistrict")}>
              {a.council_district ?? t("notListed")}
            </GlanceRow>
            <GlanceRow icon="folder" label={t("ulurpNumbers")}>
              {a.ulurp_numbers ?? t("notListed")}
            </GlanceRow>
            <GlanceRow icon="doc" label={t("ceqrNumber")}>
              {a.ceqr_number ?? t("notListed")}
            </GlanceRow>
            <GlanceRow icon="calendar" label={t("filedDate")}>
              {when(a.filed_date)}
            </GlanceRow>
            <GlanceRow icon="calendar" label={t("noticedDate")}>
              {when(a.noticed_date)}
            </GlanceRow>
            <GlanceRow icon="calendar" label={t("certifiedDate")}>
              {when(a.certified_date)}
            </GlanceRow>
          </dl>
          <button className="btn sm" style={{ marginTop: 16 }} onClick={() => navigate("/discover")}>
            {t("backToResults")}
          </button>
        </aside>
      </div>
    </div>
  );
}
