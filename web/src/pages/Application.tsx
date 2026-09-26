import { NewsArticle } from "../components/NewsFeed";
import { api } from "../lib/api";
import { useLang } from "../lib/i18n";
import { useLoad } from "../lib/meta";
import { Link } from "../lib/router";
import { storyDate, storyFromApp, topicOfApp } from "../lib/story";
import type { ZapApplication } from "../lib/types";

export function ApplicationPage({ id }: { id: string }) {
  const { t, lang } = useLang();
  const apps = useLoad(() => api.applications(), []);
  const app = apps.data?.applications.find((a) => a.id === id);
  if (apps.loading && !apps.data)
    return (
      <div className="news">
        <div className="skeleton" style={{ height: 220 }} />
      </div>
    );
  if (!app)
    return (
      <div className="news">
        <h1>{t("notFound")}</h1>
        <Link to="/" className="news-back">
          {t("back")}
        </Link>
      </div>
    );
  return <NewsArticle story={storyFromApp(app, lang)} glance={glanceOf(app, t, lang)} />;
}

function glanceOf(app: ZapApplication, t: (k: "stage" | "nextDate" | "location" | "category" | "address" | "proposedBy" | "statusFiled" | "statusReview" | "statusNoticed" | "housing" | "parks" | "buildings" | "buses") => string, lang: Parameters<typeof storyDate>[1]) {
  const status = app.public_status === "Filed" ? t("statusFiled") : app.public_status === "In Public Review" ? t("statusReview") : t("statusNoticed");
  const topic = topicOfApp(app);
  const when = storyDate(app.milestone_date ?? app.certified_date ?? app.noticed_date ?? app.filed_date, lang);
  return [
    { label: t("stage"), value: app.milestone ? `${status} · ${app.milestone}` : status },
    { label: t("nextDate"), value: when },
    { label: t("location"), value: app.location?.label ?? null },
    { label: t("category"), value: t(topic) },
    { label: t("address"), value: app.location?.label.split("·")[0]?.trim() || null },
    { label: t("proposedBy"), value: app.applicant },
  ];
}
