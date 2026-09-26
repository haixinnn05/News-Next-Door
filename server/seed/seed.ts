/**
 * Seeds the database on first run:
 *  1. Three REAL Queens CB2 documents (downloaded from nyc.gov in Sept 2026), imported through the normal pipeline.
 *     One (50-02 Queens Blvd rezoning) is published as a reviewed proposal whose every cited excerpt is checked
 *     against the PDF text. The two committee agendas are left for the team to extract with Grok.
 *  2. Three SAMPLE proposals from clearly-labelled fictional documents so the full UI (hearing dates, reminders)
 *     can be demonstrated. They carry is_sample=1 and every sample event is flagged DEMO.
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
  console.log("[seed] empty database — importing Queens CB2 documents and sample data…");

  // ---- Real: 50-02 Queens Boulevard rezoning (ULURP C240316ZMQ / N240317ZRQ)
  const qbDoc = await importSeed(db, REAL_DOCS[0]);
  for (const d of REAL_DOCS.slice(1)) await importSeed(db, d);
  const qp = getPages(db, qbDoc.id);
  const qbData: DraftData = {
    title: "50-02 Queens Boulevard Rezoning Proposal",
    category: "land_use",
    location_text: "50-02 Queens Boulevard, Woodside (Community District 2, Queens)",
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
    "皇后大道 50-02 号重新分区提案",
    "申请人请求市政府将伍德赛德（Woodside）皇后大道上的一个街区，从不允许建住宅的轻工业区，重新划分为带商业用途的中密度住宅区。简报显示，拟建一座约 261,100 平方英尺的综合用途大楼，包括 257 套公寓、约 16,700 平方英尺的底层零售空间，以及计划用于托儿服务的社区空间。根据强制性包容性住房规定，257 套公寓中有 64 套将设有收入限制。",
    qbProp.id,
  );

  // ---- Samples (fictional, clearly labelled)
  const samples: { file: string; title: string; build: (pages: { page: number; text: string }[]) => DraftData; zh: [string, string] }[] = [
    {
      file: "samples/sample-28-07-jackson-ave.html",
      title: "SAMPLE — 28-07 Jackson Ave Mixed-Use Building",
      zh: ["杰克逊大道 28-07 号综合用途建筑（示例）", "该提案将允许在杰克逊大道 28-07 号建设一栋新的 8 层综合用途建筑，底层为商业零售空间，预计包含约 120 个住宅单元。根据申请人提交的文件，项目的目的是支持当地商业，并在公共交通附近增加住房。"],
      build: (p) => ({
        title: "Mixed-Use Building at 28-07 Jackson Ave",
        category: "land_use",
        location_text: "28-07 Jackson Ave, Long Island City, NY 11101",
        address_key: "28-07-jackson-ave",
        summary: "The project would allow a new 8-story mixed-use building with ground-floor retail and approximately 120 residential units.",
        purpose: "According to the applicant's filing, the purpose is to support local businesses and add housing near public transit.",
        stage: "Public Hearing",
        stage_kind: "public_hearing",
        proposed_by: "Private applicant",
        body_name: "Queens Community Board 2",
        participation: "Attend the public hearing, or submit a written comment before or during the hearing.",
        events: [
          event({ key: "filed", type: "application_filed", title: "Application filed", description: "Filed with Queens CB 2.", date: "2026-09-12", is_demo: true }),
          event({ key: "discussion", type: "community_discussion", title: "Community discussion", description: "Open meeting to review the proposal.", date: "2026-10-01", is_demo: true }),
          event({ key: "hearing", type: "public_hearing", title: "Public hearing", date: "2026-10-14", time: "19:00", location: "Queens CB 2, 43-22 50th St, Woodside, NY", instructions: "Attend in person, or submit a written comment before or during the hearing.", is_demo: true }),
          event({ key: "board_review", type: "board_review", title: "Board review", description: "The board will discuss and may make a recommendation.", is_demo: true }),
          event({ key: "decision", type: "decision", title: "Decision by City agency", description: "Final decision made by the relevant agency.", is_demo: true }),
        ],
        evidence: [
          ev(p, "title", "Mixed-Use Building at 28-07 Jackson Ave"),
          ev(p, "location", "28-07 Jackson Ave, Long Island City, NY 11101"),
          ev(p, "summary", "a new 8-story mixed-use building with ground-floor retail and approximately 120 residential units"),
          ev(p, "purpose", "the purpose is to support local businesses and add housing near public transit"),
          ev(p, "stage", "Public hearing: October 14, 2026 at 7:00 PM"),
          ev(p, "proposed_by", "Proposed by: Private applicant."),
          ev(p, "participation", "Attend the public hearing, or submit a written comment before or during the hearing."),
          ev(p, "event:filed", "Application filed with Queens CB 2 on September 12, 2026."),
          ev(p, "event:discussion", "Community discussion: October 1, 2026"),
          ev(p, "event:hearing", "Public hearing: October 14, 2026 at 7:00 PM, Queens CB 2, 43-22 50th St, Woodside, NY."),
          ev(p, "event:board_review", "the board will discuss and may make a recommendation"),
          ev(p, "event:decision", "A final decision is made by the relevant City agency; no date has been set."),
        ],
      }),
    },
    {
      file: "samples/sample-torsney-playground.html",
      title: "SAMPLE — Torsney Playground Renovation Plan",
      zh: ["托斯尼游乐场翻新计划（示例）", "该计划将更换游乐设施，增加遮荫树木和新座椅，并重建步道，使游乐场无障碍通行。"],
      build: (p) => ({
        title: "Torsney Playground Renovation Plan",
        category: "parks_environment",
        location_text: "Skillman Ave & 43rd St, Sunnyside",
        address_key: "skillman-ave-43rd-st",
        summary: "The plan would replace play equipment, add shade trees and new seating, and rebuild paths to make the playground accessible.",
        purpose: "The stated goal is to modernize the playground and make it easier for people of all ages and abilities to use.",
        stage: "Community Discussion",
        stage_kind: "community_discussion",
        proposed_by: "NYC Parks (sample)",
        body_name: "Environment, Parks & Recreation Committee",
        participation: "Residents may comment at the meeting or email the board office before the meeting.",
        events: [event({ key: "discussion", type: "community_discussion", title: "Community discussion", date: "2026-10-21", time: "18:30", location: "Environment, Parks & Recreation Committee, by Zoom", instructions: "Comment at the meeting or email the board office before the meeting.", is_demo: true })],
        evidence: [
          ev(p, "title", "Torsney Playground Renovation Plan"),
          ev(p, "location", "Location: Skillman Ave & 43rd St, Sunnyside."),
          ev(p, "summary", "replace play equipment, add shade trees and new seating"),
          ev(p, "purpose", "The stated goal is to modernize the playground"),
          ev(p, "stage", "Community discussion: October 21, 2026 at 6:30 PM"),
          ev(p, "proposed_by", "Proposed by: NYC Parks (sample)."),
          ev(p, "participation", "Residents may comment at the meeting or email the board office before the meeting."),
          ev(p, "event:discussion", "Community discussion: October 21, 2026 at 6:30 PM, Environment, Parks & Recreation Committee, by Zoom."),
        ],
      }),
    },
    {
      file: "samples/sample-roosevelt-ave-bus.html",
      title: "SAMPLE — Roosevelt Ave Bus Priority",
      zh: ["罗斯福大道公交优先（示例）", "该提案将在罗斯福大道的一段增加公交优先车道和摄像执法，以加快公交车速度。"],
      build: (p) => ({
        title: "Roosevelt Ave Bus Priority",
        category: "transportation",
        location_text: "Roosevelt Ave, Queens",
        address_key: "roosevelt-ave-woodside",
        summary: "The proposal would add bus-priority lanes and camera enforcement along a section of Roosevelt Ave to speed up buses.",
        purpose: null,
        stage: "Review in Progress",
        stage_kind: "review_in_progress",
        proposed_by: "NYC Department of Transportation (sample)",
        body_name: "Transportation Committee",
        participation: null,
        events: [],
        evidence: [
          ev(p, "title", "Roosevelt Ave Bus Priority"),
          ev(p, "location", "Location: Roosevelt Ave, Queens."),
          ev(p, "summary", "add bus-priority lanes and camera enforcement along a section of Roosevelt Ave"),
          ev(p, "stage", "Status: Review in progress."),
          ev(p, "proposed_by", "Proposed by: NYC Department of Transportation (sample)."),
        ],
      }),
    },
  ];

  for (const s of samples) {
    const doc = await importSeed(db, { file: s.file, url: "https://example.org/sample", title: s.title, publicationDate: "2026-09-12", sample: true });
    run(db, "UPDATE documents SET official_url=? WHERE id=?", `/samples/${path.basename(s.file)}`, doc.id);
    const draft = insertDraft(db, doc.id, s.build(getPages(db, doc.id)), "seed");
    const { proposal } = publishDraft(db, draft, { isSample: true });
    run(db, "UPDATE proposals SET title_zh=?, summary_zh=? WHERE id=?", s.zh[0], s.zh[1], proposal.id);
  }
  console.log("[seed] done");
  return true;
}
