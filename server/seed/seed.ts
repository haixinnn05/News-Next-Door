/**
 * Seeds the database on first run:
 *  1. Three REAL Queens CB2 documents (downloaded from nyc.gov in Sept 2026), imported through the normal pipeline.
 *     One (50-02 Queens Blvd rezoning) is published as a reviewed proposal whose every cited excerpt is checked
 *     against the PDF text. The two committee agendas are left for the team to extract with Grok.
 *  2. No fictional sample proposals. The public feed uses the city's live applications.
 */
import fs from "node:fs";
import path from "node:path";
import { config } from "../config.ts";
import { get, run, type Db } from "../db.ts";
import { excerptAppearsIn } from "../lib/text.ts";
import { newId, nowIso } from "../lib/util.ts";
import { getPages, importDocument } from "../services/documents.ts";
import { validateDraft, type DraftData, type DraftEvent } from "../services/extraction.ts";
import { publishDraft } from "../services/proposals.ts";

const here = path.join(config.serverRoot, "seed");
const CB2 = "https://www.nyc.gov/assets/queenscb2/downloads/pdf";

interface SeedDoc {
  file: string;
  url: string;
  title: string;
  publicationDate: string | null;
  sample?: boolean;
}

const REAL_DOCS: SeedDoc[] = [
  { file: "documents/50-02-Queens-Boulevard-Rezoning-Proposal.pdf", url: `${CB2}/committee-agendas-minutes/2026/50-02-Queens-Boulevard-Rezoning-Proposal.pdf`, title: "50-02 Queens Boulevard Rezoning Proposal (applicant presentation)", publicationDate: null },
  { file: "documents/September-16-2026-Land-Use-and-Housing-Committee-Meeting-Agenda.pdf", url: `${CB2}/2026/September-16-2026-Land-Use-and-Housing-Committee-Meeting-Agenda.pdf`, title: "September 16, 2026 Land Use and Housing Committee Meeting Agenda", publicationDate: "2026-09-14" },
  { file: "documents/September-24-2026-Environment-Parks-and-Recreation-Committee-Meeting-Agenda.pdf", url: `${CB2}/committee-agendas-minutes/2026/September-24-2026-Environment-Parks-and-Recreation-Committee-Meeting-Agenda.pdf`, title: "September 24, 2026 Environment, Parks and Recreation Committee Meeting Agenda", publicationDate: "2026-09-21" },
];

function ev(pages: { page: number; text: string }[], field: string, excerpt: string) {
  const hit = pages.find((p) => excerptAppearsIn(excerpt, p.text));
  if (!hit) throw new Error(`seed evidence not found in source: [${field}] ${excerpt}`);
  return { field, page: hit.page, excerpt };
}

const event = (e: Partial<DraftEvent> & Pick<DraftEvent, "key" | "type" | "title">): DraftEvent => ({
  description: null, date: null, time: null, location: null, meeting_url: null, comment_deadline: null, instructions: null, cancelled: false, ...e,
});

function insertDraft(db: Db, documentId: string, data: DraftData, extractor: string): string {
  const doc = get<any>(db, "SELECT * FROM documents WHERE id=?", documentId);
  const issues = validateDraft(data, doc, getPages(db, documentId));
  const errors = issues.filter((i) => i.level === "error");
  if (errors.length) throw new Error(`seed draft invalid: ${errors.map((e) => e.message).join("; ")}`);
  const id = newId("drf");
  const now = nowIso();
  run(db, "INSERT INTO drafts (id, document_id, item_index, status, extractor, model, data_json, issues_json, created_at, updated_at) VALUES (?,?,0,'needs_review',?,NULL,?,?,?,?)", id, documentId, extractor, JSON.stringify(data), JSON.stringify(issues), now, now);
  return id;
}

async function importSeed(db: Db, d: SeedDoc) {
  const bytes = new Uint8Array(fs.readFileSync(path.join(here, d.file)));
  const { document } = await importDocument(db, { bytes, filename: path.basename(d.file), officialUrl: d.url, publicationDate: d.publicationDate, title: d.title, isSample: d.sample });
  return document;
}

export async function seedIfEmpty(db: Db): Promise<boolean> {
  const has = get<{ n: number }>(db, "SELECT COUNT(*) AS n FROM documents")!.n;
  if (has > 0) return false;
  console.log("[seed] empty database — importing Queens CB2 documents…");

  // ---- Real: 50-02 Queens Boulevard rezoning (ULURP C240316ZMQ / N240317ZRQ)
  const qbDoc = await importSeed(db, REAL_DOCS[0]);
  for (const d of REAL_DOCS.slice(1)) await importSeed(db, d);
  const qp = getPages(db, qbDoc.id);
  const qbData: DraftData = {
    title: "A building plan at 50-02 Queens Boulevard",
    category: "land_use",
    location_text: "50-02 Queens Boulevard, Woodside",
    address_key: "50-02-queens-blvd",
    summary:
      "The applicant is asking the City to rezone a block on Queens Boulevard in Woodside from light manufacturing, where housing is not allowed, to a medium-density residential district with a commercial overlay. The presentation shows a mixed-use building of about 261,100 square feet with 257 apartments, about 16,700 square feet of ground-floor retail, and space envisioned for child care. Under Mandatory Inclusionary Housing, 64 of the 257 apartments would be income-restricted.",
    purpose:
      "According to the applicant's presentation, the project would add homes, including permanently income-restricted apartments, in a transit-oriented location, with retail and community space at street level.",
    stage: "Community Board public review (Jun 9 – Sep 10, 2026) in the City's land use review process (ULURP)",
    stage_kind: "review_in_progress",
    proposed_by: "5002 Woodside Development LLC",
    body_name: "Uniform Land Use Review Procedure (ULURP)",
    participation:
      "The presentation describes ULURP as a public process with several review stages and opportunities to comment. The stages it lists after the Community Board are the Borough President's recommendation, a City Planning Commission public hearing and vote, and a City Council vote. It does not list dates for those stages.",
    events: [
      event({ key: "certified", type: "application_filed", title: "Application certified & referred", description: "June 2026 (no exact date listed)" }),
      event({ key: "cb_review", type: "board_review", title: "Community Board public review", description: "Public review period: Jun 9 to Sep 10, 2026", date: "2026-09-10" }),
      event({ key: "bp", type: "board_review", title: "Borough President recommendation", description: "Recommendation to City Planning — date not listed" }),
      event({ key: "cpc", type: "public_hearing", title: "City Planning Commission public hearing & vote", description: "Date not listed in this document" }),
      event({ key: "council", type: "decision", title: "City Council final vote", description: "Final vote on the rezoning — date not listed" }),
    ],
    evidence: [
      ev(qp, "title", "50-02 Queens Boulevard Rezoning Proposal"),
      ev(qp, "location", "A proposed mixed-use, mixed-income development in Woodside, Queens"),
      ev(qp, "summary", "Light manufacturing — no housing permitted"),
      ev(qp, "summary", "~240,120 sq ft — 257 apartments"),
      ev(qp, "summary", "64 of the 257 apartments would be income-restricted"),
      ev(qp, "purpose", "New housing on a wide boulevard directly served by nearby subway lines."),
      ev(qp, "stage", "Public review — Jun 9 to Sep 10, 2026"),
      ev(qp, "proposed_by", "5002 Woodside Development LLC"),
      ev(qp, "participation", "a public process with several review stages and opportunities to comment"),
      ev(qp, "event:certified", "Application certified & referred (June 2026)"),
      ev(qp, "event:cb_review", "Public review — Jun 9 to Sep 10, 2026"),
      ev(qp, "event:bp", "Recommendation to City Planning"),
      ev(qp, "event:cpc", "Public hearing & vote"),
      ev(qp, "event:council", "Final vote on the rezoning"),
    ],
  };
  const qbDraft = insertDraft(db, qbDoc.id, qbData, "seed");
  const { proposal: qbProp } = publishDraft(db, qbDraft);
  run(
    db,
    "UPDATE proposals SET title_zh=?, summary_zh=? WHERE id=?",
    "皇后大道 50-02 号的建房计划",
    "申请人请求市政府将伍德赛德（Woodside）皇后大道上的一个街区，从不允许建住宅的轻工业区，重新划分为带商业用途的中密度住宅区。简报显示，拟建一座约 261,100 平方英尺的综合用途大楼，包括 257 套公寓、约 16,700 平方英尺的底层零售空间，以及计划用于托儿服务的社区空间。根据强制性包容性住房规定，257 套公寓中有 64 套将设有收入限制。",
    qbProp.id,
  );

  console.log("[seed] done");
  return true;
}
