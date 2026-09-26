import { useEffect, useState } from "react";
import { AppListen } from "../components/AppListen";
import { FollowModal } from "../components/FollowPanel";
import { Icon } from "../components/Icon";
import { NewsArticle } from "../components/NewsFeed";
import { api } from "../lib/api";
import { fmtDate } from "../lib/format";
import { useLang, type Key, type Lang } from "../lib/i18n";
import { useLoad } from "../lib/meta";
import { Link } from "../lib/router";
import { storyFromApp, topicOfApp } from "../lib/story";
import type { ZapApplication } from "../lib/types";
import { zhCivic } from "../lib/zhCivic";
import { SaveButton } from "./Proposal";

export function ApplicationCard({ a }: { a: ZapApplication }) {
  const { lang } = useLang();
  const story = storyFromApp(a, lang);
  return (
    <Link to={story.href} className="news-row">
      <h3>{story.headline}</h3>
      {story.location && <p className="news-place">{story.location}</p>}
    </Link>
  );
}

export function ApplicationPage({ id }: { id: string }) {
  const { t, lang } = useLang();
  const res = useLoad(() => api.application(id), [id]);
  const app = res.data;
  const [following, setFollowing] = useState(false);
  if (res.loading && !app)
    return (
      <div className="news">
        <div className="skeleton" style={{ height: 220 }} />
      </div>
    );
  if (res.error || !app)
    return (
      <div className="news">
        <h1>{t("notFound")}</h1>
        <Link to="/" className="news-back">
          {t("back")}
        </Link>
      </div>
    );
  const actions = (
    <div className="row" style={{ gap: 10 }}>
      <SaveButton proposalId={app.id} />
      <button className="btn primary sm" onClick={() => setFollowing(true)}>
        <Icon name="bell" size={15} /> {t("follow")}
      </button>
    </div>
  );
  return (
    <>
      <NewsArticle story={storyFromApp(app, lang)} glance={glanceOf(app, t, lang)} body={<StoryBody app={app} />} actions={actions}>
        <AppListen id={app.id} />
      </NewsArticle>
      {following && <FollowModal proposalId={app.id} title={app.name} requestFollow={(l) => api.followApp(app.id, l)} onClose={() => setFollowing(false)} />}
    </>
  );
}

function StoryBody({ app }: { app: ZapApplication }) {
  const { t, lang } = useLang();
  const city = app.brief ? zhCivic(app.brief, lang) : null;
  const [summary, setSummary] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSummary(null);
    setError(null);
  }, [app.id, lang]);

  const summarize = async () => {
    setBusy(true);
    setError(null);
    try {
      setSummary((await api.summarize(app.id, lang)).summary);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {city && <p className="news-body">{city}</p>}
      {!summary && (
        <div className="news-summarize">
          <button type="button" disabled={busy} onClick={() => void summarize()}>
            {busy ? t("summarizing") : t("summarize")}
          </button>
        </div>
      )}
      {summary && (
        <div className="news-plain">
          <p className="news-kicker">{t("showSummary")}</p>
          <p className="news-body">{summary}</p>
          <p className="news-note">{t("summaryNote")}</p>
        </div>
      )}
      {error && <p className="news-note">{error}</p>}
    </>
  );
}

function glanceOf(app: ZapApplication, t: (k: Key) => string, lang: Lang) {
  const status = app.public_status === "Filed" ? t("statusFiled") : app.public_status === "In Public Review" ? t("statusReview") : t("statusNoticed");
  const when = (date: string | null) => (date ? fmtDate(date, lang) : null);
  const topic = topicOfApp(app);
  return [
    { label: t("stage"), value: status },
    { label: t("latestMilestone"), value: app.milestone ? zhCivic(app.milestone, lang) : null },
    { label: t("location"), value: app.location ? zhCivic(app.location.label, lang) : null },
    { label: t("category"), value: t(topic) },
    { label: t("applicant"), value: app.applicant ? zhCivic(app.applicant, lang) : null },
    { label: t("councilDistrict"), value: app.council_district },
    { label: t("ulurpNumbers"), value: app.ulurp_numbers },
    { label: t("ceqrNumber"), value: app.ceqr_number },
    { label: t("filedDate"), value: when(app.filed_date) },
    { label: t("noticedDate"), value: when(app.noticed_date) },
    { label: t("certifiedDate"), value: when(app.certified_date) },
  ];
}
