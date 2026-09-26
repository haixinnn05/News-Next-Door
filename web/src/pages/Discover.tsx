import { useMemo, useState } from "react";
import { CoverageMap } from "../components/CoverageMap";
import { Icon } from "../components/Icon";
import { LiveApplications } from "../components/LiveApplications";
import { ProposalRow } from "../components/ProposalCard";
import { api } from "../lib/api";
import { useLang, type Key } from "../lib/i18n";
import { useLoad, useMeta } from "../lib/meta";
import { useQuery, useRouter } from "../lib/router";
import { SearchBar } from "./Home";

const CATS: { key: string; label: Key }[] = [
  { key: "all", label: "all" },
  { key: "land_use", label: "land_use" },
  { key: "transportation", label: "transportation" },
  { key: "parks_environment", label: "parks_environment" },
  { key: "other", label: "other" },
];

export function Discover() {
  const { t, lang } = useLang();
  const meta = useMeta();
  const query = useQuery();
  const { navigate } = useRouter();
  const q = query.get("q") ?? "";
  const cat = query.get("category") ?? "all";
  const res = useLoad(() => api.search(q, cat), [q, cat]);
  const apps = useLoad(() => api.applications(), []);
  const [hovered, setHovered] = useState<string | null>(null);
  const set = (next: { q?: string; category?: string }) => {
    const p = new URLSearchParams();
    const nq = next.q ?? q;
    const nc = next.category ?? cat;
    if (nq) p.set("q", nq);
    if (nc !== "all") p.set("category", nc);
    navigate(`/discover${p.toString() ? `?${p}` : ""}`, { replace: true });
  };
  const data = res.data;
  const results = data?.results ?? [];
  const showLive = !q && (cat === "all" || cat === "land_use");
  const places = useMemo(
    () =>
      showLive
        ? (apps.data?.applications ?? []).flatMap((a) => (a.location ? [{ id: a.id, title: a.name, lat: a.location.lat, lng: a.location.lng, url: a.zap_url }] : []))
        : [],
    [apps.data, showLive],
  );

  return (
    <div className="container page">
      <div className="discover">
        <div>
          <h1>{t("findNearYou")}</h1>
          <p className="muted" style={{ margin: "0 0 16px" }}>
            {t("findSub")}
          </p>
          <SearchBar key={q} initial={q} compact onSearch={(nq) => set({ q: nq })} />
          <div className="filter-chips" style={{ marginTop: 14 }}>
            {CATS.map((c) => (
              <button key={c.key} className={`filter-chip${cat === c.key ? " on" : ""}`} onClick={() => set({ category: c.key })} aria-pressed={cat === c.key}>
                {t(c.label)}
              </button>
            ))}
          </div>

          {data?.matched_address && (
            <div className="banner green" style={{ marginTop: 14 }}>
              <Icon name="pin" size={16} />
              <span>
                {lang === "zh" ? "已匹配地址：" : "Matched indexed address: "}
                <strong>{data.matched_address.full}</strong>
              </span>
            </div>
          )}

          {showLive && <LiveApplications source={apps} hovered={hovered} onHover={setHovered} />}

          <div className="results">
            {res.loading && !data && [0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 80 }} />)}
            {res.error && <div className="banner red">{res.error}</div>}
            {data?.status === "unsupported_address" && (
              <div className="state-box">
                <h3>{t("unsupported")}</h3>
                <p style={{ margin: "0 0 12px" }}>{t("unsupportedText")}</p>
                {meta && (
                  <p className="small subtle" style={{ margin: 0 }}>
                    {lang === "zh" ? "已收录地址示例：" : "Indexed addresses include: "}
                    {meta.coverage.addresses.slice(0, 4).map((a) => a.label).join(" · ")}
                  </p>
                )}
              </div>
            )}
            {data?.status === "no_proposals_at_address" && (
              <div className="state-box">
                <h3>{t("noAtAddress")}</h3>
                <p style={{ margin: 0 }}>{t("noAtAddressText")}</p>
              </div>
            )}
            {data?.status === "empty" && (
              <div className="state-box">
                <h3>{t("noResults")}</h3>
                <button className="btn sm" onClick={() => set({ q: "", category: "all" })}>
                  {lang === "zh" ? "清除搜索" : "Clear search"}
                </button>
              </div>
            )}
            {results.map((p) => (
              <ProposalRow key={p.id} p={p} hovered={hovered === p.id} onHover={setHovered} />
            ))}
          </div>
          {meta?.show_sample_data && results.some((r) => r.is_sample) && (
            <p className="xs subtle" style={{ marginTop: 14 }}>
              {lang === "zh" ? "标有“示例”的提案为演示用虚构数据。" : "Proposals marked “Sample” are fictional demo data, shown so the full experience can be tried. Others come from real Queens CB2 documents."}
            </p>
          )}
        </div>
        <CoverageMap proposals={results} places={places} hovered={hovered} onHover={setHovered} />
      </div>
    </div>
  );
}
