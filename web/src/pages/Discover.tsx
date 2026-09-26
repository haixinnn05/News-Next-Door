import { useEffect, useMemo, useState } from "react";
import { AddressSearch } from "../components/AddressSearch";
import { CoverageMap } from "../components/CoverageMap";
import { NewsFeed } from "../components/NewsFeed";
import { api } from "../lib/api";
import { useAccount } from "../lib/account";
import { useBoard } from "../lib/board";
import { useLang } from "../lib/i18n";
import { useLoad } from "../lib/meta";
import { useQuery, useRouter } from "../lib/router";
import { storyFromApp, storyFromCity } from "../lib/story";
import type { LocateResult } from "../lib/types";
import { zhBoardName } from "../lib/zhCivic";

const QUEENS_LABELS: [string, number, number][] = [
  ["LONG ISLAND CITY", 40.751, -73.951],
  ["SUNNYSIDE", 40.7388, -73.928],
  ["WOODSIDE", 40.7488, -73.899],
  ["MASPETH", 40.7265, -73.905],
];

type Scope = "zone" | "city";

function NewsScope({ scope, onChange }: { scope: Scope; onChange: (scope: Scope) => void }) {
  const { t } = useLang();
  return (
    <label className="news-scope">
      <span className="sr-only">{t("home")}</span>
      <select value={scope} onChange={(e) => onChange(e.target.value as Scope)} aria-label={t("home")}>
        <option value="zone">{t("zoneNews")}</option>
        <option value="city">{t("cityNews")}</option>
      </select>
    </label>
  );
}

export function Discover() {
  const { t, lang } = useLang();
  const { path, navigate } = useRouter();
  const query = useQuery();
  const scope: Scope = query.get("scope") === "city" ? "city" : "zone";
  const setScope = (next: Scope) => {
    const base = path === "/discover" ? "/discover" : "/";
    navigate(next === "city" ? `${base}?scope=city` : base, { replace: true });
  };
  const { user, loading: accountLoading, zoneId, zoneReady, openSignIn, openZone, saveZone } = useAccount();
  const { boards } = useBoard();
  const board = boards.find((b) => b.id === zoneId) ?? null;
  const apps = useLoad(() => (board ? api.applications(board.id) : Promise.reject(new Error("zone"))), [board?.id ?? ""]);
  const boundary = useLoad(() => (board ? api.boundary(board.id) : Promise.reject(new Error("zone"))), [board?.id ?? ""]);
  const city = useLoad(() => (scope === "city" ? api.cityNews("en") : Promise.reject(new Error("city"))), [scope]);
  const [cityLang, setCityLang] = useState(city.data?.articles ?? null);
  useEffect(() => {
    if (scope !== "city" || !city.data) {
      setCityLang(null);
      return;
    }
    if (lang === "en") {
      setCityLang(city.data.articles);
      return;
    }
    let alive = true;
    api
      .cityNews(lang)
      .then((feed) => alive && setCityLang(feed.articles))
      .catch(() => alive && setCityLang(city.data?.articles ?? null));
    return () => {
      alive = false;
    };
  }, [scope, lang, city.data]);
  const [hovered, setHovered] = useState<string | null>(null);
  useEffect(() => setHovered(null), [board?.id, scope]);
  const [located, setLocated] = useState<LocateResult | null>(null);
  const onLocate = (r: LocateResult | null) => {
    setLocated(r);
    if (r && r.board_id !== zoneId) void saveZone(r.board_id).catch(() => {});
  };
  const shown = board && located?.board_id === board.id ? located : null;
  const home = useMemo(() => (shown ? { label: shown.label, lat: shown.lat, lng: shown.lng } : null), [shown]);
  const fresh = board && apps.data?.source.board_id === board.id ? apps.data : null;
  const outline = board && boundary.data?.board_id === board.id ? boundary.data.geometry : null;
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
  const heading = <NewsScope scope={scope} onChange={setScope} />;

  if (accountLoading || (user && !zoneReady && scope === "zone")) {
    return (
      <div className="news">
        {heading}
        <div className="skeleton" style={{ height: 160 }} />
      </div>
    );
  }

  if (scope === "city") {
    const cityStories = (cityLang ?? city.data?.articles ?? []).map(storyFromCity);
    return (
      <div className="discover-news city-only">
        {city.loading && !city.data ? (
          <div className="news">
            {heading}
            <div className="skeleton" style={{ height: 160 }} />
          </div>
        ) : (
          <NewsFeed
            stories={cityStories}
            empty={city.error ?? t("cityNewsEmpty")}
            credit={t("cityNewsLede")}
            heading={heading}
            wide
          />
        )}
      </div>
    );
  }

  if (!user || !board) {
    return (
      <div className="welcome-wrap">
        {heading}
        <div className="welcome">
          <img src="/favicon.svg" alt="" width="72" height="72" />
          <h1>News Next Door</h1>
          {user ? (
            <p>{t("chooseZoneWhy")}</p>
          ) : (
            <ol className="welcome-steps">
              {[t("welcome1"), t("welcome2"), t("welcome3")].map((step, i) => (
                <li key={step}>
                  <span>{i + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
          )}
          <div className="welcome-actions">
            <button className="news-cta" onClick={() => (user ? openZone() : openSignIn())}>
              {user ? t("chooseZone") : t("signIn")}
            </button>
            {!user && (
              <button className="welcome-secondary" onClick={() => openSignIn(null, "create")}>
                {t("createAccount")}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="discover-news">
      <div>
        {apps.loading && !fresh ? (
          <div className="news">
            {heading}
            <div className="skeleton" style={{ height: 160 }} />
          </div>
        ) : (
          <NewsFeed stories={stories} hovered={hovered} onHover={setHovered} heading={heading} />
        )}
      </div>
      <CoverageMap
        proposals={[]}
        places={places}
        boundary={outline}
        home={home}
        areaLabel={lang === "zh" ? zhBoardName(board, lang) : board.shortName}
        labels={board.id === "queens-cb2" ? QUEENS_LABELS : []}
        hovered={hovered}
        onHover={setHovered}
      >
        <AddressSearch located={shown} onLocate={onLocate} />
      </CoverageMap>
    </div>
  );
}
