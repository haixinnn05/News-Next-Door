import { NewsArticle } from "../components/NewsFeed";
import { api } from "../lib/api";
import { useLang } from "../lib/i18n";
import { useLoad } from "../lib/meta";
import { Link } from "../lib/router";
import { storyFromApp } from "../lib/story";

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
  return <NewsArticle story={storyFromApp(app, lang)} />;
}
