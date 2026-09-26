/**
 * Community boards a resident can select. Application rows come from NYC Planning's
 * Zoning Application Portal. Boundaries come from the city's Community Districts layer
 * (BoroCD), not from a hand-drawn outline.
 */
export interface Board {
  id: string;
  name: string;
  shortName: string;
  borough: string;
  /** Community-board number within the borough, e.g. 2 for Queens CB 2. */
  number: number;
  /** ZAP community-district code, e.g. Q02. */
  zapCode: string;
  /** NYC Department of City Planning BoroCD, e.g. 402. */
  boroCd: number;
  neighborhoods: string[];
}

export const BOARDS: Board[] = [
  { id: "queens-cb2", name: "Queens Community Board 2", shortName: "Queens CB 2", borough: "Queens", number: 2, zapCode: "Q02", boroCd: 402, neighborhoods: ["Long Island City", "Sunnyside", "Woodside", "Maspeth"] },
  { id: "queens-cb1", name: "Queens Community Board 1", shortName: "Queens CB 1", borough: "Queens", number: 1, zapCode: "Q01", boroCd: 401, neighborhoods: ["Astoria", "Old Astoria", "Long Island City"] },
  { id: "queens-cb5", name: "Queens Community Board 5", shortName: "Queens CB 5", borough: "Queens", number: 5, zapCode: "Q05", boroCd: 405, neighborhoods: ["Ridgewood", "Maspeth", "Middle Village", "Glendale"] },
  { id: "brooklyn-cb1", name: "Brooklyn Community Board 1", shortName: "Brooklyn CB 1", borough: "Brooklyn", number: 1, zapCode: "K01", boroCd: 301, neighborhoods: ["Greenpoint", "Williamsburg"] },
  { id: "manhattan-cb4", name: "Manhattan Community Board 4", shortName: "Manhattan CB 4", borough: "Manhattan", number: 4, zapCode: "M04", boroCd: 104, neighborhoods: ["Chelsea", "Hell's Kitchen"] },
];

export const DEFAULT_BOARD_ID = "queens-cb2";

export function boardById(id: string | undefined): Board | undefined {
  return BOARDS.find((board) => board.id === id);
}
