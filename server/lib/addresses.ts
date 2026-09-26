/**
 * Curated address index for the covered area (Queens Community Board 2 — Long Island City,
 * Sunnyside, Woodside, Maspeth). Coordinates are approximate and used only to place map pins.
 * Addresses not in this index are reported as "coverage unavailable" — never matched to "nearby" results.
 */
export interface IndexedAddress {
  key: string;
  label: string;          // display form, e.g. "50-02 Queens Blvd"
  full: string;           // "50-02 Queens Blvd, Woodside, NY 11377"
  neighborhood: string;
  lat: number;
  lng: number;
  aliases: string[];
}

export const BOARD = {
  id: "queens-cb2",
  name: "Queens Community Board 2",
  shortName: "Queens CB 2",
  neighborhoods: ["Long Island City", "Sunnyside", "Woodside", "Maspeth"],
  office: "43-22 50th Street, 2nd Floor, Woodside, NY 11377",
  website: "https://www.nyc.gov/site/queenscb2/index.page",
  documentsPage: "https://www.nyc.gov/site/queenscb2/meetings/committee-agendas-minutes.page",
};

export const ADDRESS_INDEX: IndexedAddress[] = [
  { key: "50-02-queens-blvd", label: "50-02 Queens Blvd", full: "50-02 Queens Blvd, Woodside, NY 11377", neighborhood: "Woodside", lat: 40.7433, lng: -73.9122, aliases: ["50-02 queens boulevard", "5002 queens blvd"] },
  { key: "50-01-queens-blvd", label: "50-01 Queens Blvd", full: "50-01 Queens Blvd, Woodside, NY 11377", neighborhood: "Woodside", lat: 40.7428, lng: -73.9127, aliases: ["50-01 queens boulevard", "5001 queens blvd"] },
  { key: "28-07-jackson-ave", label: "28-07 Jackson Ave", full: "28-07 Jackson Ave, Long Island City, NY 11101", neighborhood: "Long Island City", lat: 40.7483, lng: -73.9386, aliases: ["28-07 jackson avenue", "2807 jackson ave"] },
  { key: "10-01-45th-rd", label: "10-01 45th Road", full: "10-01 45th Road, Long Island City, NY 11101", neighborhood: "Long Island City", lat: 40.7478, lng: -73.9510, aliases: ["10-01 45th rd", "1001 45th road"] },
  { key: "5-50-44th-dr", label: "5-50 44th Drive", full: "5-50 44th Drive, Long Island City, NY 11101", neighborhood: "Long Island City", lat: 40.7502, lng: -73.9575, aliases: ["5-50 44th dr", "5-52 44th drive", "5-52 44th dr"] },
  { key: "45-40-vernon-blvd", label: "45-40 Vernon Blvd", full: "45-40 Vernon Blvd, Long Island City, NY 11101", neighborhood: "Long Island City", lat: 40.7466, lng: -73.9528, aliases: ["45-40 vernon boulevard"] },
  { key: "39-88-44th-st", label: "39-88 44th Street", full: "39-88 44th Street, Sunnyside, NY 11104", neighborhood: "Sunnyside", lat: 40.7478, lng: -73.9212, aliases: ["39-88 44th st"] },
  { key: "44-17-greenpoint-ave", label: "44-17 Greenpoint Ave", full: "44-17 Greenpoint Ave, Sunnyside, NY 11104", neighborhood: "Sunnyside", lat: 40.7405, lng: -73.9205, aliases: ["44-17 greenpoint avenue"] },
  { key: "43-22-50th-st", label: "43-22 50th Street", full: "43-22 50th Street, Woodside, NY 11377", neighborhood: "Woodside", lat: 40.7432, lng: -73.9135, aliases: ["43-22 50th st", "community board 2 office"] },
  { key: "skillman-ave-43rd-st", label: "Skillman Ave & 43rd St", full: "Skillman Ave & 43rd St, Sunnyside, NY 11104", neighborhood: "Sunnyside", lat: 40.7462, lng: -73.9212, aliases: ["torsney playground", "skillman avenue"] },
  { key: "roosevelt-ave-woodside", label: "Roosevelt Ave (Woodside)", full: "Roosevelt Ave, Woodside, NY 11377", neighborhood: "Woodside", lat: 40.7456, lng: -73.9028, aliases: ["roosevelt avenue", "roosevelt ave"] },
];

/** Approximate outline of Community District 2 (schematic, for the "covered area" overlay). */
export const COVERAGE_POLYGON: [number, number][] = [
  [40.7571, -73.9529], [40.7545, -73.9422], [40.7520, -73.9310], [40.7552, -73.9182], [40.7568, -73.9043],
  [40.7528, -73.8948], [40.7390, -73.8960], [40.7300, -73.8950], [40.7235, -73.9020], [40.7200, -73.9170],
  [40.7266, -73.9350], [40.7315, -73.9480], [40.7385, -73.9570], [40.7470, -73.9612], [40.7540, -73.9590],
];

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[.,#]/g, " ")
    .replace(/\bavenue\b/g, "ave")
    .replace(/\bboulevard\b/g, "blvd")
    .replace(/\bstreet\b/g, "st")
    .replace(/\broad\b/g, "rd")
    .replace(/\bdrive\b/g, "dr")
    .replace(/\b(\d+)(st|nd|rd|th)\b/g, "$1")
    .replace(/\b(long island city|sunnyside|woodside|maspeth|queens|ny|new york|lic)\b/g, " ")
    .replace(/\b\d{5}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Does the query look like a street address (house number + street)? */
export function looksLikeAddress(q: string): boolean {
  return /^\s*\d+(-\d+)?\s+\S+/.test(q) || /\b(st|street|ave|avenue|blvd|boulevard|rd|road|dr|drive|pl|place)\b/i.test(q);
}

export function findAddress(q: string): IndexedAddress | undefined {
  const n = norm(q);
  if (!n) return undefined;
  return ADDRESS_INDEX.find((a) => [a.label, a.full, ...a.aliases].some((x) => norm(x) === n || (n.length >= 6 && norm(x).startsWith(n))));
}

export function addressByKey(key: string | null | undefined): IndexedAddress | undefined {
  return key ? ADDRESS_INDEX.find((a) => a.key === key) : undefined;
}

/** Best-effort match of free-text location to the index (used when publishing a draft). */
export function matchLocationText(text: string | null | undefined): IndexedAddress | undefined {
  if (!text) return undefined;
  const n = norm(text);
  return ADDRESS_INDEX.find((a) => [a.label, ...a.aliases].some((x) => n.includes(norm(x))));
}
