import type { ReactNode } from "react";
import { useLang, type Key } from "../lib/i18n";
import { storyDate, type Story, type Topic } from "../lib/story";
import { Link } from "../lib/router";

const TOPIC: Record<Topic, Key> = {
  housing: "housing",
  parks: "parks",
  buildings: "buildings",
  buses: "buses",
  city: "nytSource",
  weather: "weather",
  politics: "politics",
  transit: "transit",
  business: "business",
  arts: "arts",
  crime: "crime",
  sports: "sports",
  schools: "schools",
  health: "health",
  newyork: "newyork",
};

function kickerOf(story: Story, t: (k: Key) => string): string {
  return story.kicker?.trim() || t(TOPIC[story.topic]);
}

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
  const cls = `${featured ? "news-feature" : "news-row"}${hovered ? " hover" : ""}`;
  const body = (
    <>
      <p className="news-kicker">{kickerOf(story, t)}</p>
      {featured ? <h2>{story.headline}</h2> : <h3>{story.headline}</h3>}
      {story.dek && <p className="news-dek">{story.dek}</p>}
      <Meta story={story} />
    </>
  );
  if (story.external) {
    return (
      <a
        href={story.href}
        className={cls}
        target="_blank"
        rel="noreferrer"
        onMouseEnter={() => onHover?.(story.id)}
        onMouseLeave={() => onHover?.(null)}
      >
        {body}
      </a>
    );
  }
  return (
    <Link to={story.href} className={cls} onMouseEnter={() => onHover?.(story.id)} onMouseLeave={() => onHover?.(null)}>
      {body}
    </Link>
  );
}

export function NewsFeed({
  stories,
  title,
  empty,
  credit,
  hovered,
  onHover,
  heading,
  wide = false,
}: {
  stories: Story[];
  title?: string;
  empty?: string;
  credit?: string;
  hovered?: string | null;
  onHover?: (id: string | null) => void;
  heading?: ReactNode;
  wide?: boolean;
}) {
  const { t } = useLang();
  const [first, ...rest] = stories;
  return (
    <div className={`news${wide ? " news-wide" : ""}`}>
      {heading ?? <h1 className="news-today">{title ?? t("home")}</h1>}
      {stories.length === 0 && <p className="news-meta">{empty ?? t("newsEmpty")}</p>}
      {first && <NewsStory story={first} featured hovered={hovered === first.id} onHover={onHover} />}
      {wide && rest.length > 0 ? (
        <div className="city-grid">
          {rest.map((story) => (
            <NewsStory key={story.id} story={story} hovered={hovered === story.id} onHover={onHover} />
          ))}
        </div>
      ) : (
        rest.map((story) => <NewsStory key={story.id} story={story} hovered={hovered === story.id} onHover={onHover} />)
      )}
      {credit && <p className="news-credit">{credit}</p>}
    </div>
  );
}

export function NewsArticle({
  story,
  glance,
  body,
  actions,
  children,
  backTo = "/",
  sourceLabel,
}: {
  story: Story;
  glance?: { label: string; value: string | null }[];
  body?: ReactNode;
  actions?: ReactNode;
  /** Extra content after the body, such as the audio briefing. */
  children?: ReactNode;
  backTo?: string;
  sourceLabel?: string;
}) {
  const { t, lang } = useLang();
  const date = storyDate(story.date, lang);
  return (
    <article className="news news-article">
      <div className="news-top">
        <Link to={backTo} className="news-back">
          {t("back")}
        </Link>
        {actions}
      </div>
      <p className="news-kicker">{kickerOf(story, t)}</p>
      <h1>{story.headline}</h1>
      {story.dek && <p className="news-dek">{story.dek}</p>}
      {date && <p className="news-meta">{date}</p>}
      {story.location && <p className="news-place">{story.location}</p>}
      {body}
      {children}
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
          {sourceLabel ?? t("cityRecord")}
        </a>
      )}
    </article>
  );
}
