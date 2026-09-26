import L from "leaflet";
import { useEffect, useRef } from "react";
import { useLang } from "../lib/i18n";
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

const pinSvg = (active: boolean) => {
  const fill = active ? "#111" : "#e10600";
  return `<svg class="pin" viewBox="0 0 30 38" xmlns="http://www.w3.org/2000/svg"><path d="M15 37s12-11.2 12-21A12 12 0 0 0 3 16c0 9.8 12 21 12 21Z" fill="${fill}" stroke="#111" stroke-width="2"/><circle cx="15" cy="15.5" r="4.6" fill="#fff"/></svg>`;
};

export interface MapPlace {
  id: string;
  title: string;
  lat: number;
  lng: number;
  url: string;
}

export function CoverageMap({ proposals, places = [], hovered, onHover }: { proposals: ProposalCard[]; places?: MapPlace[]; hovered: string | null; onHover: (id: string | null) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const markers = useRef(new Map<string, L.Marker>());
  const { navigate } = useRouter();
  const { t, lang } = useLang();

  useEffect(() => {
    if (!el.current || map.current) return;
    const area = L.latLngBounds(OUTLINE);
    const m = L.map(el.current, {
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: false,
      maxBounds: area.pad(1.4),
      maxBoundsViscosity: 0.8,
    });
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 16,
      className: "map-tiles",
    }).addTo(m);
    m.fitBounds(area.pad(0.45));
    L.polygon(OUTLINE, { color: "#111", weight: 2.5, opacity: 1, fillColor: "#e10600", fillOpacity: 0.12 }).addTo(m);
    const labels: [string, number, number][] = [
      ["LONG ISLAND CITY", 40.751, -73.951],
      ["SUNNYSIDE", 40.7388, -73.928],
      ["WOODSIDE", 40.7488, -73.899],
      ["MASPETH", 40.7265, -73.905],
    ];
    for (const [name, lat, lng] of labels)
      L.marker([lat, lng], { interactive: false, icon: L.divIcon({ className: "", html: `<div style="font:600 11px Inter,sans-serif;letter-spacing:.12em;color:#111;white-space:nowrap;transform:translate(-50%,-50%)">${name}</div>` }) }).addTo(m);
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
    const add = (id: string, lat: number, lng: number, title: string, onClick: () => void) => {
      const mk = L.marker([lat, lng], {
        icon: L.divIcon({ className: "", html: pinSvg(false), iconSize: [30, 38], iconAnchor: [15, 37] }),
        title,
        riseOnHover: true,
      })
        .bindTooltip(title, { direction: "top", offset: [0, -36], className: "pin-tip" })
        .on("click", onClick)
        .on("mouseover", () => onHover(id))
        .on("mouseout", () => onHover(null));
      mk.addTo(g);
      markers.current.set(id, mk);
    };
    for (const p of proposals) {
      if (!p.address) continue;
      add(p.id, p.address.lat, p.address.lng, titleOf(p, lang), () => navigate(`/p/${p.id}`));
    }
    for (const place of places) {
      add(place.id, place.lat, place.lng, place.title, () => {
        if (place.url.startsWith("/")) navigate(place.url);
        else window.open(place.url, "_blank", "noopener,noreferrer");
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposals, places, lang]);

  useEffect(() => {
    for (const [id, mk] of markers.current) {
      const on = id === hovered;
      mk.setIcon(L.divIcon({ className: "", html: pinSvg(on), iconSize: on ? [36, 46] : [30, 38], iconAnchor: on ? [18, 45] : [15, 37] }));
      if (on) mk.openTooltip();
      else mk.closeTooltip();
    }
  }, [hovered]);

  return (
    <div className="map-wrap">
      <div ref={el} style={{ width: "100%", height: "100%" }} aria-label="Map of Queens Community Board 2 showing proposal locations" role="region" />
      <div className="map-legend">
        <span className="dot" /> {t("coveredArea")}
      </div>
      <div className="map-attrib">© Esri</div>
      <div className="map-zoom">
        <button onClick={() => map.current?.zoomIn()} aria-label="Zoom in">
          <Icon name="plus" size={16} />
        </button>
        <button onClick={() => map.current?.zoomOut()} aria-label="Zoom out">
          <Icon name="minus" size={16} />
        </button>
      </div>
    </div>
  );
}
