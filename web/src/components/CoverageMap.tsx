import L from "leaflet";
import { useEffect, useRef } from "react";
import { useLang } from "../lib/i18n";
import { useMeta } from "../lib/meta";
import { useRouter } from "../lib/router";
import type { ProposalCard } from "../lib/types";
import { titleOf } from "../lib/format";
import { Icon } from "./Icon";

// Approximate outline of Community District 2 (schematic).
const OUTLINE: [number, number][] = [
  [40.7571, -73.9529], [40.7545, -73.9422], [40.752, -73.931], [40.7552, -73.9182], [40.7568, -73.9043],
  [40.7528, -73.8948], [40.739, -73.896], [40.73, -73.895], [40.7235, -73.902], [40.72, -73.917],
  [40.7266, -73.935], [40.7315, -73.948], [40.7385, -73.957], [40.747, -73.9612], [40.754, -73.959],
];

const pinSvg = (active: boolean) =>
  `<svg class="pin" viewBox="0 0 30 38" xmlns="http://www.w3.org/2000/svg"><path d="M15 37s12-11.2 12-21A12 12 0 0 0 3 16c0 9.8 12 21 12 21Z" fill="${active ? "#24503a" : "#1b3a2b"}" stroke="#fff" stroke-width="2"/><circle cx="15" cy="15.5" r="4.6" fill="#fff"/></svg>`;

export function CoverageMap({ proposals, hovered, onHover }: { proposals: ProposalCard[]; hovered: string | null; onHover: (id: string | null) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const markers = useRef(new Map<string, L.Marker>());
  const { navigate } = useRouter();
  const { t, lang } = useLang();
  const meta = useMeta();

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { zoomControl: false, attributionControl: false, scrollWheelZoom: false }).setView([40.7425, -73.925], 14);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(m);
    L.polygon(OUTLINE, { color: "#1b3a2b", weight: 2, opacity: 0.7, fillColor: "#4d7a3a", fillOpacity: 0.08, dashArray: "6 5" }).addTo(m);
    const labels: [string, number, number][] = [
      ["LONG ISLAND CITY", 40.7465, -73.9465],
      ["SUNNYSIDE", 40.7425, -73.924],
      ["WOODSIDE", 40.7455, -73.9055],
      ["MASPETH", 40.7275, -73.908],
    ];
    for (const [name, lat, lng] of labels)
      L.marker([lat, lng], { interactive: false, icon: L.divIcon({ className: "", html: `<div style="font:600 10px Inter,sans-serif;letter-spacing:.14em;color:#5d5f58;white-space:nowrap;transform:translate(-50%,-50%)">${name}</div>` }) }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    const g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    markers.current.clear();
    const pts: L.LatLngExpression[] = [];
    for (const p of proposals) {
      if (!p.address) continue;
      const mk = L.marker([p.address.lat, p.address.lng], {
        icon: L.divIcon({ className: "", html: pinSvg(false), iconSize: [30, 38], iconAnchor: [15, 37] }),
        title: p.title,
        riseOnHover: true,
      })
        .bindTooltip(titleOf(p, lang), { direction: "top", offset: [0, -36], className: "pin-tip" })
        .on("click", () => navigate(`/p/${p.id}`))
        .on("mouseover", () => onHover(p.id))
        .on("mouseout", () => onHover(null));
      mk.addTo(g);
      markers.current.set(p.id, mk);
      pts.push([p.address.lat, p.address.lng]);
    }
    if (pts.length === 1) m.setView(pts[0], 15);
    else if (pts.length > 1) m.fitBounds(L.latLngBounds(pts).pad(0.35), { maxZoom: 15 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposals, lang]);

  useEffect(() => {
    for (const [id, mk] of markers.current) {
      mk.setIcon(L.divIcon({ className: "", html: pinSvg(id === hovered), iconSize: id === hovered ? [36, 46] : [30, 38], iconAnchor: id === hovered ? [18, 45] : [15, 37] }));
      if (id === hovered) mk.openTooltip();
      else mk.closeTooltip();
    }
  }, [hovered]);

  return (
    <div className="map-wrap">
      <div ref={el} style={{ width: "100%", height: "100%" }} aria-label="Map of Queens Community Board 2 showing proposal locations" role="region" />
      <div className="map-legend">
        <span className="dot" /> {t("coveredArea")}
        {meta && <span className="subtle" style={{ fontWeight: 500 }}>· {meta.coverage.addresses.length} {lang === "zh" ? "个已收录地址" : "indexed addresses"}</span>}
      </div>
      <div className="map-zoom">
        <button onClick={() => map.current?.zoomIn()} aria-label="Zoom in">
          <Icon name="plus" size={16} />
        </button>
        <button onClick={() => map.current?.zoomOut()} aria-label="Zoom out">
          <Icon name="minus" size={16} />
        </button>
      </div>
      <div className="map-attrib">
        © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors · approx. boundary
      </div>
    </div>
  );
}
