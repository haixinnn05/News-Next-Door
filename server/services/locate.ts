/**
 * Address → community board. Geocodes with NYC Planning's GeoSearch (NYC addresses only), finds the
 * community district containing the point, and falls back to the closest board we cover by distance
 * to its official outline.
 */
import { BOARDS, type Board } from "../lib/boards.ts";
import { HttpError } from "../lib/util.ts";
import { communityDistrictAt, communityDistrictBoundary, type DistrictGeometry } from "./boundary.ts";

const GEOSEARCH = "https://geosearch.planninglabs.nyc/v2";
const BOROUGHS = ["Manhattan", "Bronx", "Brooklyn", "Queens", "Staten Island"];

export interface LocateResult {
  label: string;
  lat: number;
  lng: number;
  board_id: string;
  /** True when the address is inside the returned board; false when it's the closest covered board. */
  inside: boolean;
  /** The address's own community district, e.g. "Bronx CB 5"; null for parks, airports and water. */
  district: string | null;
  /** Metres from the address to the returned board's outline (0 when inside). */
  distance_m: number;
}

/** "Queens CB 3" from BoroCD 403. Numbers above 18 are joint interest areas (parks, airports), not boards. */
function districtName(boroCd: number): string | null {
  const borough = BOROUGHS[Math.floor(boroCd / 100) - 1];
  const number = boroCd % 100;
  return borough && number >= 1 && number <= 18 ? `${borough} CB ${number}` : null;
}

export interface AddressSuggestion {
  /** Full one-line address, e.g. "30-15 Steinway Street, Astoria, NY". */
  label: string;
  /** Street line, e.g. "30-15 Steinway Street". */
  name: string;
  /** Neighbourhood, borough and ZIP, e.g. "Astoria, Queens 11103". */
  area: string;
  lat: number;
  lng: number;
}

type GeoFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: { label?: string; name?: string; neighbourhood?: string; borough?: string; postalcode?: string };
};

/** GeoSearch returns street lines in capitals ("30-15 STEINWAY STREET"). */
const titleCase = (s: string) => s.replace(/\b([A-Z])([A-Z]+)\b/g, (_, a: string, b: string) => a + b.toLowerCase());

function toSuggestion(f: GeoFeature): AddressSuggestion | null {
  const [lng, lat] = f.geometry?.coordinates ?? [];
  const p = f.properties ?? {};
  if (typeof lat !== "number" || typeof lng !== "number" || !p.label) return null;
  const [street, ...rest] = p.label.replace(/, USA$/, "").split(", ");
  const name = titleCase(p.name ?? street);
  const area = [p.neighbourhood, [p.borough, p.postalcode].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return { label: [titleCase(street), ...rest].join(", "), name, area, lat, lng };
}

async function geosearch(endpoint: "search" | "autocomplete", text: string, size: number): Promise<AddressSuggestion[]> {
  const url = new URL(`${GEOSEARCH}/${endpoint}`);
  url.searchParams.set("text", text);
  url.searchParams.set("size", String(size));
  let body: { features?: GeoFeature[] };
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`GeoSearch returned ${res.status}`);
    body = (await res.json()) as typeof body;
  } catch (err) {
    console.error("[locate]", err);
    throw new HttpError(502, "Address search is temporarily unavailable. Try again, or pick a board from the list.");
  }
  return (body.features ?? []).map(toSuggestion).filter((s): s is AddressSuggestion => !!s);
}

const suggestCache = new Map<string, AddressSuggestion[]>();

/** Type-ahead matches. The same building often comes back under alias street names, so keep one per point. */
export async function suggestAddresses(query: string): Promise<AddressSuggestion[]> {
  const text = query.trim().replace(/\s+/g, " ");
  if (text.length < 3 || text.length > 200) return [];
  const key = text.toLowerCase();
  const hit = suggestCache.get(key);
  if (hit) return hit;
  const tokens = key.split(/[\s,]+/).filter(Boolean);
  /** Typed words that each start a different word of the street line ("st" can't reuse "steinway"). */
  const score = (s: AddressSuggestion) => {
    const words = s.name.toLowerCase().split(/\s+/);
    return tokens.filter((t) => {
      const i = words.findIndex((w) => w.startsWith(t));
      if (i < 0) return false;
      words.splice(i, 1);
      return true;
    }).length;
  };
  const byPoint = new Map<string, AddressSuggestion>();
  for (const s of await geosearch("autocomplete", text, 10)) {
    const at = `${s.lat.toFixed(5)},${s.lng.toFixed(5)}`;
    const prev = byPoint.get(at);
    if (!prev || score(s) > score(prev)) byPoint.set(at, s);
  }
  const list = [...byPoint.values()].sort((a, b) => score(b) - score(a)).slice(0, 6);
  if (suggestCache.size >= 500) suggestCache.delete(suggestCache.keys().next().value!);
  suggestCache.set(key, list);
  return list;
}

async function geocode(text: string): Promise<{ label: string; lat: number; lng: number }> {
  const [hit] = await geosearch("search", text, 1);
  if (!hit) throw new HttpError(404, "We couldn't find that address in New York City.");
  return { label: hit.label, lat: hit.lat, lng: hit.lng };
}

/** Distance in metres from a point to the nearest edge of a polygon (equirectangular, fine at city scale). */
function distanceToOutline(lat: number, lng: number, geometry: DistrictGeometry): number {
  const kx = 111_320 * Math.cos((lat * Math.PI) / 180);
  const ky = 110_540;
  const polygons = (geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates) as number[][][][];
  let best = Infinity;
  for (const polygon of polygons)
    for (const ring of polygon)
      for (let i = 1; i < ring.length; i++) {
        const ax = (ring[i - 1][0] - lng) * kx, ay = (ring[i - 1][1] - lat) * ky;
        const bx = (ring[i][0] - lng) * kx, by = (ring[i][1] - lat) * ky;
        const dx = bx - ax, dy = by - ay;
        const len = dx * dx + dy * dy;
        const t = len ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len)) : 0;
        best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
      }
  return best;
}

async function closestBoard(lat: number, lng: number): Promise<{ board: Board; distance: number }> {
  const scored = await Promise.all(
    BOARDS.map(async (board) => {
      try {
        return { board, distance: distanceToOutline(lat, lng, await communityDistrictBoundary(board.boroCd)) };
      } catch {
        return { board, distance: Infinity };
      }
    }),
  );
  const best = scored.reduce((a, b) => (b.distance < a.distance ? b : a));
  if (!Number.isFinite(best.distance)) throw new HttpError(502, "The community district map is temporarily unavailable.");
  return best;
}

export async function locateAddress(query: string): Promise<LocateResult> {
  const text = query.trim();
  if (text.length < 3) throw new HttpError(400, "Type a street address, like 31-00 47th Ave, Queens.");
  if (text.length > 200) throw new HttpError(400, "That address is too long.");
  return locatePlace(await geocode(text));
}

/** A point already geocoded by a picked suggestion, so it isn't re-searched by its (possibly ambiguous) text. */
export async function locatePoint(label: string, lat: number, lng: number): Promise<LocateResult> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 40.4 || lat > 41 || lng < -74.3 || lng > -73.6) {
    throw new HttpError(400, "That point isn't in New York City.");
  }
  return locatePlace({ label: label.trim().slice(0, 200) || `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng });
}

async function locatePlace(place: { label: string; lat: number; lng: number }): Promise<LocateResult> {
  const boroCd = await communityDistrictAt(place.lat, place.lng);
  const district = boroCd === null ? null : districtName(boroCd);
  const own = BOARDS.find((b) => b.boroCd === boroCd);
  if (own) return { ...place, board_id: own.id, inside: true, district, distance_m: 0 };
  const { board, distance } = await closestBoard(place.lat, place.lng);
  return { ...place, board_id: board.id, inside: false, district, distance_m: Math.round(distance) };
}
