import { useEffect, useMemo, useState } from "react";
import { CoverageMap } from "../components/CoverageMap";
import { NewsFeed } from "../components/NewsFeed";
import { api } from "../lib/api";
import { useBoard } from "../lib/board";
import { useLang } from "../lib/i18n";
import { useLoad } from "../lib/meta";
import { storyFromApp } from "../lib/story";
import { zhBoardName } from "../lib/zhCivic";

const QUEENS_LABELS: [string, number, number][] = [
  ["LONG ISLAND CITY", 40.751, -73.951],
  ["SUNNYSIDE", 40.7388, -73.928],
  ["WOODSIDE", 40.7488, -73.899],
  ["MASPETH", 40.7265, -73.905],
];

export function Discover() {
  const { t, lang } = useLang();
  const { board } = useBoard();
  const apps = useLoad(() => api.applications(board.id), [board.id]);
  const boundary = useLoad(() => api.boundary(board.id), [board.id]);
  const [hovered, setHovered] = useState<string | null>(null);
  useEffect(() => setHovered(null), [board.id]);

  const fresh = apps.data?.source.board_id === board.id ? apps.data : null;
  const outline = boundary.data?.board_id === board.id ? boundary.data.geometry : null;
  const list = fresh?.applications ?? [];
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
        {apps.loading && !fresh ? (
          <div className="news">
            <div className="skeleton" style={{ height: 28, width: 140, marginBottom: 24 }} />
            <div className="skeleton" style={{ height: 160 }} />
          </div>
        ) : (
          <NewsFeed stories={stories} title={t("home")} hovered={hovered} onHover={setHovered} />
        )}
      </div>
      <CoverageMap
        proposals={[]}
        places={places}
        boundary={outline}
        areaLabel={lang === "zh" ? zhBoardName(board, lang) : board.shortName}
        labels={board.id === "queens-cb2" ? QUEENS_LABELS : []}
        hovered={hovered}
        onHover={setHovered}
      />
    </div>
  );
}
