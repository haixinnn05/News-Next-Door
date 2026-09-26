/**
 * Live Queens Community District 2 land-use applications from NYC Open Data.
 *
 * Dataset: Zoning Application Portal (ZAP) — Project Data (hgx4-8ukb).
 * This is the city's published copy of the applications residents can also open
 * at https://zap.planning.nyc.gov. No API key is required.
 *
 * These records are the city's own fields (name, brief, status, applicant).
 * They are not page-cited briefings, so they stay out of the publish pipeline.
 */
import type { Board } from "../lib/boards.ts";
import { HttpError } from "../lib/util.ts";

const DATASET = "https://data.cityofnewyork.us/resource/hgx4-8ukb.json";
const DATASET_PAGE = "https://data.cityofnewyork.us/City-Government/Zoning-Application-Portal-ZAP-Project-Data/hgx4-8ukb";
const BBL_DATASET = "2iga-a6mk";
const PLUTO_DATASET = "64uk-42ks";
const TTL_MS = 10 * 60 * 1000;

const PUBLIC_STATUSES = ["Filed", "In Public Review", "Noticed"] as const;
export type ZapPublicStatus = (typeof PUBLIC_STATUSES)[number];

const STATUS_RANK: Record<string, number> = { "In Public Review": 0, Noticed: 1, Filed: 2 };

const ACTION_LABELS: Record<string, string> = {
  ZM: "Zoning map amendment",
  ZR: "Zoning text amendment",
  ZS: "Special permit",
  ZA: "Authorization",
  ZC: "Certification",
  PC: "Site selection and acquisition",
  PQ: "Acquisition",
  MM: "City map change",
  HA: "Urban development action",
  LD: "Landmark",
  HI: "Landmark designation",
  CS: "Substantial compliance",
};

export interface ZapRow {
  project_id?: string;
  project_name?: string;
  project_brief?: string;
  project_status?: string;
  public_status?: string;
  ulurp_numbers?: string;
  ceqr_number?: string;
  primary_applicant?: string;
  applicant_type?: string;
  community_district?: string;
  cc_district?: string | number;
  current_milestone?: string;
  current_milestone_date?: string;
  app_filed_date?: string;
  noticed_date?: string;
  certified_referred?: string;
  actions?: string;
  dcp_visibility?: string;
}

export interface ZapApplication {
  id: string;
  name: string;
  brief: string | null;
  public_status: ZapPublicStatus;
  applicant: string | null;
  applicant_type: string | null;
  ulurp_numbers: string | null;
  ceqr_number: string | null;
  districts: string;
  council_district: string | null;
  actions: { code: string; label: string }[];
  milestone: string | null;
  milestone_date: string | null;
  filed_date: string | null;
  noticed_date: string | null;
  certified_date: string | null;
  zap_url: string;
  /** Tax-lot centroid from MapPLUTO, joined through the ZAP BBL table. Null when the city lists no lot. */
  location: { label: string; lat: number; lng: number; lot_count: number } | null;
}

export interface ZapFeed {
  source: {
    name: string;
    dataset_url: string;
    board_id: string;
    board: string;
    fetched_at: string;
  };
  applications: ZapApplication[];
}

function day(value: string | undefined): string | null {
  const match = value && /^(\d{4}-\d{2}-\d{2})/.exec(value);
  return match ? match[1] : null;
}

const BOROUGH_NAME: Record<string, string> = { Q: "Queens", K: "Brooklyn", M: "Manhattan", X: "Bronx", R: "Staten Island" };

export function districtLabel(code: string): string {
  return code
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = /^([QKMXR])(\d+)$/.exec(part);
      return match ? `${BOROUGH_NAME[match[1]]} CB ${Number(match[2])}` : part;
    })
    .join(", ");
}

/** True when a ZAP community_district cell includes this exact code (Q01 does not match Q10). */
export function includesDistrict(code: string | undefined, zapCode: string): boolean {
  return (code ?? "")
    .split(",")
    .map((part) => part.trim())
    .includes(zapCode);
}

/** SoQL predicate. zapCode must be a catalog code like Q02, never raw user text. */
export function communityDistrictClause(zapCode: string): string {
  if (!/^[QKMXR]\d{2}$/.test(zapCode)) throw new Error(`Invalid community district code: ${zapCode}`);
  return `(community_district = '${zapCode}' OR community_district like '${zapCode},%' OR community_district like '%,${zapCode}' OR community_district like '%, ${zapCode}' OR community_district like '%,${zapCode},%' OR community_district like '%, ${zapCode},%')`;
}

/** City project ids, such as 2023M0213. Used to keep a lookup from becoming a query. */
export const PROJECT_ID = /^[A-Za-z0-9]{4,32}$/;

/** One public, active ZAP project. District membership is checked separately. */
export function toApplication(row: ZapRow): ZapApplication | null {
  const id = row.project_id?.trim();
  const name = row.project_name?.trim();
  if (!id || !name) return null;
  if (row.project_status && row.project_status !== "Active") return null;
  if (row.dcp_visibility && row.dcp_visibility !== "General Public") return null;
  if (!PUBLIC_STATUSES.includes(row.public_status as ZapPublicStatus)) return null;
  const actions = (row.actions ?? "")
    .split(/[;,]/)
    .map((code) => code.trim())
    .filter(Boolean)
    .map((code) => ({ code, label: ACTION_LABELS[code] ?? code }));
  return {
    id,
    name,
    brief: row.project_brief?.trim() || null,
    public_status: row.public_status as ZapPublicStatus,
    applicant: row.primary_applicant?.trim() || null,
    applicant_type: row.applicant_type?.trim() || null,
    ulurp_numbers: row.ulurp_numbers?.trim() || null,
    ceqr_number: row.ceqr_number?.trim() || null,
    districts: districtLabel(row.community_district ?? ""),
    council_district: row.cc_district == null || row.cc_district === "" ? null : String(row.cc_district),
    actions,
    milestone: row.current_milestone?.trim() || null,
    milestone_date: day(row.current_milestone_date),
    filed_date: day(row.app_filed_date),
    noticed_date: day(row.noticed_date),
    certified_date: day(row.certified_referred),
    zap_url: `https://zap.planning.nyc.gov/projects/${encodeURIComponent(id)}`,
    location: null,
  };
}

export function normalizeZapRows(rows: ZapRow[], zapCode: string): ZapApplication[] {
  const applications: ZapApplication[] = [];
  for (const row of rows) {
    if (!includesDistrict(row.community_district, zapCode)) continue;
    const app = toApplication(row);
    if (!app) continue;
    applications.push({ ...app, districts: districtLabel(row.community_district ?? zapCode) });
  }
  applications.sort((a, b) => {
    const rank = (STATUS_RANK[a.public_status] ?? 9) - (STATUS_RANK[b.public_status] ?? 9);
    if (rank) return rank;
    return (b.milestone_date ?? b.certified_date ?? b.filed_date ?? "").localeCompare(a.milestone_date ?? a.certified_date ?? a.filed_date ?? "") || a.name.localeCompare(b.name);
  });
  return applications;
}

export interface ZapBblRow {
  project_id?: string;
  bbl?: string;
}

export interface PlutoLot {
  bbl?: string;
  address?: string;
  latitude?: string;
  longitude?: string;
}

function bblKey(value: string | undefined): string | null {
  if (!value) return null;
  const digits = value.split(".")[0].replace(/\D/g, "");
  return digits || null;
}

function prettyAddress(raw: string): string {
  const titled = raw.toLowerCase().replace(/(^|[^a-z0-9])([a-z])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase());
  return titled
    .replace(/\bAvenue\b/g, "Ave")
    .replace(/\bBoulevard\b/g, "Blvd")
    .replace(/\bStreet\b/g, "St")
    .replace(/\bRoad\b/g, "Rd")
    .replace(/\bDrive\b/g, "Dr")
    .replace(/\bPlace\b/g, "Pl");
}

/** One map point per application: the centroid of its validated tax lots. */
export function locateApplications(apps: ZapApplication[], bblRows: ZapBblRow[], lots: PlutoLot[]): ZapApplication[] {
  const byProject = new Map<string, string[]>();
  for (const row of bblRows) {
    const id = row.project_id?.trim();
    const bbl = bblKey(row.bbl);
    if (!id || !bbl) continue;
    const list = byProject.get(id) ?? [];
    if (!list.includes(bbl)) list.push(bbl);
    byProject.set(id, list);
  }
  const byBbl = new Map<string, { address: string | null; lat: number; lng: number }>();
  for (const lot of lots) {
    const bbl = bblKey(lot.bbl);
    const lat = Number(lot.latitude);
    const lng = Number(lot.longitude);
    if (!bbl || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    byBbl.set(bbl, { address: lot.address?.trim() || null, lat, lng });
  }
  return apps.map((app) => {
    const points = (byProject.get(app.id) ?? []).flatMap((bbl) => {
      const point = byBbl.get(bbl);
      return point ? [point] : [];
    });
    if (!points.length) return { ...app, location: null };
    const lat = points.reduce((sum, point) => sum + point.lat, 0) / points.length;
    const lng = points.reduce((sum, point) => sum + point.lng, 0) / points.length;
    let nearest = points[0];
    let best = Infinity;
    for (const point of points) {
      if (!point.address) continue;
      const dist = (point.lat - lat) ** 2 + (point.lng - lng) ** 2;
      if (dist < best) {
        best = dist;
        nearest = point;
      }
    }
    const primary = nearest.address ? prettyAddress(nearest.address) : null;
    const label = !primary ? `${points.length} tax lots` : points.length === 1 ? primary : `${primary} · ${points.length} tax lots`;
    return { ...app, location: { label, lat, lng, lot_count: points.length } };
  });
}

async function soda(dataset: string, params: Record<string, string>): Promise<unknown[]> {
  const url = new URL(`https://data.cityofnewyork.us/resource/${dataset}.json`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const res = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(12_000) });
  if (!res.ok) throw new Error(`NYC Open Data ${dataset} returned ${res.status}`);
  const body = await res.json();
  if (!Array.isArray(body)) throw new Error(`NYC Open Data ${dataset} returned an unexpected response`);
  return body;
}

async function attachLocations(apps: ZapApplication[]): Promise<ZapApplication[]> {
  if (!apps.length) return apps;
  const ids = apps.map((app) => `'${app.id.replace(/[^A-Za-z0-9]/g, "")}'`).join(",");
  const bbls = (await soda(BBL_DATASET, { $select: "project_id,bbl", $where: `project_id in (${ids})`, $limit: "500" })) as ZapBblRow[];
  const keys = [...new Set(bbls.flatMap((row) => { const key = bblKey(row.bbl); return key ? [key] : []; }))];
  if (!keys.length) return apps;
  const lots: PlutoLot[] = [];
  for (let i = 0; i < keys.length; i += 40) {
    const chunk = keys.slice(i, i + 40);
    lots.push(...((await soda(PLUTO_DATASET, { $select: "bbl,address,latitude,longitude", $where: `bbl in (${chunk.join(",")})`, $limit: "500" })) as PlutoLot[]));
  }
  return locateApplications(apps, bbls, lots);
}

const cache = new Map<string, { at: number; body: ZapFeed }>();

export async function districtApplications(board: Board, now = Date.now()): Promise<ZapFeed> {
  const hit = cache.get(board.id);
  if (hit && now - hit.at < TTL_MS) return hit.body;
  const url = new URL(DATASET);
  url.searchParams.set("$select", ZAP_SELECT);
  url.searchParams.set(
    "$where",
    `${communityDistrictClause(board.zapCode)} AND public_status in ('Filed', 'In Public Review', 'Noticed') AND project_status = 'Active' AND (dcp_visibility = 'General Public' OR dcp_visibility IS NULL)`,
  );
  url.searchParams.set("$limit", "100");

  let rows: unknown;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(12_000) });
    if (!res.ok) throw new Error(`NYC Open Data returned ${res.status}`);
    rows = await res.json();
  } catch (err) {
    console.error("[zap]", err);
    throw new HttpError(502, "NYC Planning's application list is temporarily unavailable.");
  }
  if (!Array.isArray(rows)) {
    console.error("[zap] unexpected payload", rows);
    throw new HttpError(502, "NYC Planning's application list is temporarily unavailable.");
  }

  let applications = normalizeZapRows(rows as ZapRow[], board.zapCode);
  let located = true;
  try {
    applications = await attachLocations(applications);
  } catch (err) {
    located = false;
    console.error("[zap] locations", err);
  }
  const body: ZapFeed = {
    source: {
      name: "NYC Open Data — Zoning Application Portal (ZAP) Project Data",
      dataset_url: DATASET_PAGE,
      board_id: board.id,
      board: board.name,
      fetched_at: new Date(now).toISOString(),
    },
    applications,
  };
  if (located) cache.set(board.id, { at: now, body });
  return body;
}

const ZAP_SELECT = [
  "project_id",
  "project_name",
  "project_brief",
  "project_status",
  "public_status",
  "ulurp_numbers",
  "ceqr_number",
  "primary_applicant",
  "applicant_type",
  "community_district",
  "cc_district",
  "current_milestone",
  "current_milestone_date",
  "app_filed_date",
  "noticed_date",
  "certified_referred",
  "actions",
  "dcp_visibility",
].join(",");

const oneCache = new Map<string, { at: number; app: ZapApplication }>();

/** One live project by its city id, including tax-lot location when the city lists lots. */
export async function applicationById(id: string, now = Date.now()): Promise<ZapApplication> {
  if (!PROJECT_ID.test(id)) throw new HttpError(404, "Application not found");
  for (const hit of cache.values()) {
    if (now - hit.at >= TTL_MS) continue;
    const found = hit.body.applications.find((app) => app.id === id);
    if (found) return found;
  }
  const cached = oneCache.get(id);
  if (cached && now - cached.at < TTL_MS) return cached.app;

  const url = new URL(DATASET);
  url.searchParams.set("$select", ZAP_SELECT);
  url.searchParams.set(
    "$where",
    `project_id = '${id}' AND public_status in ('Filed', 'In Public Review', 'Noticed') AND project_status = 'Active' AND (dcp_visibility = 'General Public' OR dcp_visibility IS NULL)`,
  );
  url.searchParams.set("$limit", "1");

  let rows: unknown;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(12_000) });
    if (!res.ok) throw new Error(`NYC Open Data returned ${res.status}`);
    rows = await res.json();
  } catch (err) {
    console.error("[zap]", err);
    throw new HttpError(502, "NYC Planning's application list is temporarily unavailable.");
  }
  if (!Array.isArray(rows)) throw new HttpError(502, "NYC Planning's application list is temporarily unavailable.");
  const app = rows.length ? toApplication(rows[0] as ZapRow) : null;
  if (!app) throw new HttpError(404, "Application not found");

  let located = app;
  try {
    [located] = await attachLocations([app]);
  } catch (err) {
    console.error("[zap] locations", err);
  }
  oneCache.set(id, { at: now, app: located });
  return located;
}
