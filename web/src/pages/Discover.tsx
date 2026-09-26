import { useMemo, useState } from "react";
import { CoverageMap } from "../components/CoverageMap";
import { NewsFeed } from "../components/NewsFeed";
import { api } from "../lib/api";
import { useLang } from "../lib/i18n";
import { useLoad } from "../lib/meta";
import { storyFromApp } from "../lib/story";

export function Discover() {
  const { t, lang } = useLang();
  const apps = useLoad(() => api.applications(), []);
  const [hovered, setHovered] = useState<string | null>(null);
  const list = apps.data?.applications ?? [];
  const stories = list.map((a) => storyFromApp(a, lang));
  const places = useMemo(
    () =>
      list.flatMap((a) => {
        if (!a.location) return [];
        const story = storyFromApp(a, lang);
        return [{ id: a.id, title: story.headline, lat: a.location.lat, lng: a.location.lng, url: story.href }];
      }),
    [list, lang],
  );

  return (
    <div className="discover-news">
      <div>
        {apps.loading && !apps.data ? (
          <div className="news">
            <div className="skeleton" style={{ height: 28, width: 140, marginBottom: 24 }} />
            <div className="skeleton" style={{ height: 160 }} />
          </div>
        ) : (
          <NewsFeed stories={stories} title={t("home")} hovered={hovered} onHover={setHovered} />
        )}
      </div>
      <CoverageMap proposals={[]} places={places} hovered={hovered} onHover={setHovered} />
    </div>
  );
}
