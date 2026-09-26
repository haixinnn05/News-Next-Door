import L from "leaflet";
import { useEffect, useRef } from "react";
import { useLang } from "../lib/i18n";
import { useRouter } from "../lib/router";
import type { DistrictGeometry, ProposalCard } from "../lib/types";
import { titleOf } from "../lib/format";
import { Icon } from "./Icon";

const pinSvg = (active: boolean, color = "#1b3a2b") => {
  const fill = color === "#1b3a2b" ? (active ? "#24503a" : "#1b3a2b") : active ? "#1e3a8a" : color;
  return `<svg class="pin" viewBox="0 0 30 38" xmlns="http://www.w3.org/2000/svg"><path d="M15 37s12-11.2 12-21A12 12 0 0 0 3 16c0 9.8 12 21 12 21Z" fill="${fill}" stroke="#fff" stroke-width="2"/><circle cx="15" cy="15.5" r="4.6" fill="#fff"/></svg>`;
};

export interface MapPlace {
  id: string;
  title: string;
  lat: number;
  lng: number;
  url: string;
}

export function CoverageMap({ proposals, places = [], boundary = null, areaLabel, hovered, onHover }: { proposals: ProposalCard[]; places?: MapPlace[]; boundary?: DistrictGeometry | null; areaLabel: string; hovered: string | null; onHover: (id: string | null) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.FeatureGroup | null>(null);
  const outline = useRef<L.GeoJSON | null>(null);
  const markers = useRef(new Map<string, L.Marker>());
  const { navigate } = useRouter();
  const { t, lang } = useLang();

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { zoomControl: false, attributionControl: false, scrollWheelZoom: false }).setView([40.74, -73.93], 12);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(m);
    layer.current = L.featureGroup().addTo(m);
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
      outline.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    const g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    markers.current.clear();
    const pts: L.LatLngExpression[] = [];
    const add = (id: string, lat: number, lng: number, title: string, color: string | undefined, onClick: () => void) => {
      const mk = L.marker([lat, lng], {
        icon: L.divIcon({ className: "", html: pinSvg(false, color), iconSize: [30, 38], iconAnchor: [15, 37] }),
        title,
        riseOnHover: true,
        zIndexOffset: color ? 400 : 0,
      })
        .bindTooltip(title, { direction: "top", offset: [0, -36], className: "pin-tip" })
        .on("click", onClick)
        .on("mouseover", () => onHover(id))
        .on("mouseout", () => onHover(null));
      mk.addTo(g);
      markers.current.set(id, mk);
      pts.push([lat, lng]);
    };
    for (const p of proposals) {
      if (!p.address) continue;
      add(p.id, p.address.lat, p.address.lng, titleOf(p, lang), undefined, () => navigate(`/p/${p.id}`));
    }
    for (const place of places) {
      add(place.id, place.lat, place.lng, place.title, "#2d3f82", () => (place.url.startsWith("/") ? navigate(place.url) : window.open(place.url, "_blank", "noopener,noreferrer")));
    }
    outline.current?.remove();
    outline.current = null;
    if (boundary) {
      outline.current = L.geoJSON({ type: "Feature", geometry: boundary, properties: {} } as GeoJSON.Feature, {
        style: { color: "#1b3a2b", weight: 2, opacity: 0.8, fillColor: "#4d7a3a", fillOpacity: 0.08 },
      }).addTo(m);
      g.bringToFront();
    }
    const frame = outline.current?.getBounds();
    const pinBounds = pts.length ? L.latLngBounds(pts) : null;
    const bounds = frame?.isValid() ? frame : pinBounds;
    if (bounds && pinBounds && frame?.isValid()) bounds.extend(pinBounds);
    if (bounds?.isValid()) m.fitBounds(bounds.pad(0.12), { maxZoom: 15 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposals, places, boundary, lang]);

  useEffect(() => {
    const live = new Set(places.map((p) => p.id));
    for (const [id, mk] of markers.current) {
      const on = id === hovered;
      mk.setIcon(L.divIcon({ className: "", html: pinSvg(on, live.has(id) ? "#2d3f82" : undefined), iconSize: on ? [36, 46] : [30, 38], iconAnchor: on ? [18, 45] : [15, 37] }));
      if (on) mk.openTooltip();
      else mk.closeTooltip();
    }
  }, [hovered, places]);

  return (
    <div className="map-wrap">
      <div ref={el} style={{ width: "100%", height: "100%" }} aria-label={`Map of ${areaLabel} showing proposal locations`} role="region" />
      <div className="map-legend">
        <span className="dot" /> {areaLabel}
        {places.length > 0 && (
          <>
            <span className="dot live" /> {t("livePins")}
          </>
        )}
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
        © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> · NYC Community Districts
      </div>
    </div>
  );
}
