import { useEffect, useMemo, useState } from "react";
import { CoverageMap } from "../components/CoverageMap";
import { LiveApplications } from "../components/LiveApplications";
import { api } from "../lib/api";
import { useBoard } from "../lib/board";
import { useLang } from "../lib/i18n";
import { useLoad } from "../lib/meta";
import { useQuery, useRouter } from "../lib/router";
import { SearchBar } from "./Home";

export function Discover() {
  const { t } = useLang();
  const { board } = useBoard();
  const query = useQuery();
  const { navigate } = useRouter();
  const q = query.get("q") ?? "";
  const apps = useLoad(() => api.applications(board.id), [board.id]);
  const boundary = useLoad(() => api.boundary(board.id), [board.id]);
  const [hovered, setHovered] = useState<string | null>(null);
  useEffect(() => setHovered(null), [board.id]);

  const fresh = apps.data?.source.board_id === board.id ? apps.data : null;
  const outline = boundary.data?.board_id === board.id ? boundary.data.geometry : null;
  const places = useMemo(() => {
    const list = fresh?.applications ?? [];
    const needle = q.trim().toLowerCase();
    return list.flatMap((a) => {
      if (!a.location) return [];
      if (needle && ![a.name, a.brief, a.applicant, a.ulurp_numbers, a.districts, a.location.label].some((v) => v?.toLowerCase().includes(needle))) return [];
      return [{ id: a.id, title: a.name, lat: a.location.lat, lng: a.location.lng, url: a.zap_url }];
    });
  }, [fresh, q]);

  return (
    <div className="container page">
      <div className="discover">
        <div>
          <h1>{t("findNearYou")}</h1>
          <p className="muted" style={{ margin: "0 0 16px" }}>
            {board.name}: {board.neighborhoods.join(", ")}.
          </p>
          <SearchBar key={`${board.id}:${q}`} initial={q} compact onSearch={(nq) => navigate(`/discover${nq ? `?q=${encodeURIComponent(nq)}` : ""}`, { replace: true })} />
          {boundary.error && <div className="banner red" style={{ marginTop: 14 }}>{boundary.error}</div>}
          <LiveApplications boardId={board.id} boardName={board.shortName} query={q} source={apps} hovered={hovered} onHover={setHovered} />
        </div>
        <CoverageMap proposals={[]} places={places} boundary={outline} areaLabel={board.shortName} hovered={hovered} onHover={setHovered} />
      </div>
    </div>
  );
}
