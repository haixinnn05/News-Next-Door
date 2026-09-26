/**
 * Official NYC community-district polygon (DCP Community Districts, BoroCD, WGS84).
 */
import { HttpError } from "../lib/util.ts";

const LAYER = "https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/arcgis/rest/services/NYC_Community_Districts/FeatureServer/0/query";

export interface DistrictGeometry {
  type: "Polygon" | "MultiPolygon";
  coordinates: number[][][] | number[][][][];
}

const cache = new Map<number, DistrictGeometry>();

export async function communityDistrictBoundary(boroCd: number): Promise<DistrictGeometry> {
  if (!Number.isInteger(boroCd)) throw new HttpError(404, "Unknown community board");
  const hit = cache.get(boroCd);
  if (hit) return hit;
  const url = new URL(LAYER);
  url.searchParams.set("where", `BoroCD=${boroCd}`);
  url.searchParams.set("outFields", "BoroCD");
  url.searchParams.set("returnGeometry", "true");
  url.searchParams.set("outSR", "4326");
  url.searchParams.set("f", "geojson");
  let body: { features?: { geometry?: DistrictGeometry }[] };
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(12_000) });
    if (!res.ok) throw new Error(`Community district boundary returned ${res.status}`);
    body = (await res.json()) as { features?: { geometry?: DistrictGeometry }[] };
  } catch (err) {
    console.error("[boundary]", err);
    throw new HttpError(502, "The community district map is temporarily unavailable.");
  }
  const geometry = body.features?.[0]?.geometry;
  if (!geometry || (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon") || !geometry.coordinates) {
    throw new HttpError(502, "The community district map is temporarily unavailable.");
  }
  cache.set(boroCd, geometry);
  return geometry;
}
