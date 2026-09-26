import type { ReactNode } from "react";
import { useLang, type Key } from "../lib/i18n";
import { storyDate, type Story, type Topic } from "../lib/story";
import { Link } from "../lib/router";

const TOPIC: Record<Topic, Key> = {
  housing: "housing",
  parks: "parks",
  buildings: "buildings",
  buses: "buses",
};

function Meta({ story }: { story: Story }) {
  const { lang } = useLang();
  const date = storyDate(story.date, lang);
  const bits = [date, story.location].filter(Boolean);
  if (!bits.length) return null;
  return <p className="news-meta">{bits.join("  ·  ")}</p>;
}

export function NewsStory({
  story,
  featured = false,
  hovered = false,
  onHover,
}: {
  story: Story;
  featured?: boolean;
  hovered?: boolean;
  onHover?: (id: string | null) => void;
}) {
  const { t } = useLang();
  return (
    <Link
      to={story.href}
      className={`${featured ? "news-feature" : "news-row"}${hovered ? " hover" : ""}`}
      onMouseEnter={() => onHover?.(story.id)}
      onMouseLeave={() => onHover?.(null)}
    >
      <p className="news-kicker">{t(TOPIC[story.topic])}</p>
      {featured ? <h2>{story.headline}</h2> : <h3>{story.headline}</h3>}
      <Meta story={story} />
    </Link>
  );
}

export function NewsFeed({
  stories,
  title,
  hovered,
  onHover,
}: {
  stories: Story[];
  title?: string;
  hovered?: string | null;
  onHover?: (id: string | null) => void;
}) {
  const { t } = useLang();
  const [first, ...rest] = stories;
  return (
    <div className="news">
      <h1 className="news-today">{title ?? t("home")}</h1>
      {stories.length === 0 && <p className="news-meta">{t("newsEmpty")}</p>}
      {first && <NewsStory story={first} featured hovered={hovered === first.id} onHover={onHover} />}
      {rest.map((story) => (
        <NewsStory key={story.id} story={story} hovered={hovered === story.id} onHover={onHover} />
      ))}
    </div>
  );
}

export function NewsArticle({ story, glance, body, actions }: { story: Story; glance?: { label: string; value: string | null }[]; body?: ReactNode; actions?: ReactNode }) {
  const { t, lang } = useLang();
  const date = storyDate(story.date, lang);
  return (
    <article className="news news-article">
      <div className="news-top">
        <Link to="/" className="news-back">
          {t("back")}
        </Link>
        {actions}
      </div>
      <p className="news-kicker">{t(TOPIC[story.topic])}</p>
      <h1>{story.headline}</h1>
      {date && <p className="news-meta">{date}</p>}
      {story.location && <p className="news-place">{story.location}</p>}
      {body}
      {glance && glance.length > 0 && (
        <aside className="news-glance">
          <h2>{t("atAGlance")}</h2>
          <dl>
            {glance.map((row) => (
              <div key={row.label}>
                <dt>{row.label}</dt>
                <dd className={row.value ? undefined : "unknown"}>{row.value || t("notListed")}</dd>
              </div>
            ))}
          </dl>
        </aside>
      )}
      {story.sourceUrl && (
        <a className="news-source" href={story.sourceUrl} target="_blank" rel="noreferrer">
          {t("cityRecord")}
        </a>
      )}
    </article>
  );
}
