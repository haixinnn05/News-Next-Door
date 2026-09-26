/**
 * Texting the line: LIST, HELP, and questions answered only from what the resident follows.
 * The model is a stand-in, so these run offline and deterministically.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { all, openMemoryDb } from "./db.ts";
import { answerProblem, respondToInbound } from "./services/assistant.ts";
import type { NotificationRow } from "./services/notifications.ts";
import { queueAppDemoUpdate } from "./services/appBriefings.ts";
import { createAppFollowCode, handleInbound } from "./services/subscriptions.ts";
import type { ZapApplication } from "./services/zap.ts";

const app: ZapApplication = {
  id: "2023Q0177",
  name: "50-02 Queens Blvd Rezoning",
  brief: "A zoning map amendment to facilitate a new 9-story building with 257 units; 64 income restricted.",
  public_status: "In Public Review",
  applicant: "5002 Woodside Development LLC",
  applicant_type: "Private",
  ulurp_numbers: "240316ZMQ",
  ceqr_number: null,
  districts: "Queens CB 2",
  council_district: "26",
  actions: [],
  milestone: "EAS - Community Board Referral",
  milestone_date: "2026-06-11",
  filed_date: null,
  noticed_date: null,
  certified_date: null,
  zap_url: "https://zap.planning.nyc.gov/projects/2023Q0177",
  location: null,
};
const fetchApp = async () => app;
let n = 0;
const text = (db: ReturnType<typeof openMemoryDb>, body: string) => {
  const key = `m${++n}`;
  return { key, r: handleInbound(db, { providerEventId: key, handle: "+16465550100", spaceId: null, text: body, transport: "simulator" }) };
};
const replies = (db: ReturnType<typeof openMemoryDb>) => all<NotificationRow>(db, "SELECT * FROM notifications WHERE kind='reply' ORDER BY rowid");

function followed() {
  const db = openMemoryDb();
  text(db, createAppFollowCode(db, app, "en").code);
  return db;
}

test("the welcome text is short and plain: headline, status, link, official record, how to ask", () => {
  const db = followed();
  const welcome = all<NotificationRow>(db, "SELECT * FROM notifications WHERE kind='confirmation'")[0].body;
  assert.match(welcome, /You're now following:\n/);
  assert.doesNotMatch(welcome, /zoning map amendment/i); // the city's technical wording stays on the page
  assert.match(welcome, /Curious what it is\? Text me “What is it\?”/);
  assert.match(welcome, /Where it stands: In public review/);
  assert.match(welcome, /Official record: https:\/\/zap\.planning\.nyc\.gov/);
  assert.match(welcome, /LIST = what you follow\nLANGUAGE = switch language\nSTOP = no more texts/);
});

test("residents pick their text language: from the page they follow, or by texting LANGUAGE", async () => {
  const db = openMemoryDb();
  text(db, createAppFollowCode(db, app, "es").code);
  const welcome = all<NotificationRow>(db, "SELECT * FROM notifications WHERE kind='confirmation'")[0].body;
  assert.match(welcome, /Ahora sigues:/);
  assert.match(welcome, /LIST = lo que sigues/);

  const menu = text(db, "language");
  assert.equal(menu.r.action, "language_menu");
  assert.match(replies(db).at(-1)!.body, /Elige tu idioma[\s\S]*2\. 中文[\s\S]*8\. Русский/);
  assert.equal(text(db, "2").r.action, "language_set");
  assert.match(replies(db).at(-1)!.body, /以后我会用中文/);
  assert.equal(text(db, "Français").r.action, "language_set");
  assert.match(replies(db).at(-1)!.body, /désormais en français/);

  // a language picked by text sticks when they follow something else from an English page
  text(db, createAppFollowCode(db, { ...app, id: "2025Q0316" }, "en").code);
  assert.match(all<NotificationRow>(db, "SELECT * FROM notifications WHERE kind='confirmation'").at(-1)!.body, /Vous suivez maintenant/);
  // a bare number is only a language choice right after the menu... here it's a question
  assert.equal(text(db, "7").r.action, "question");
});

test("a question is answered from the followed record, with the page link", async () => {
  const db = followed();
  const { key, r } = text(db, "How many apartments are affordable?");
  assert.equal(r.action, "question");
  let seen = "";
  await respondToInbound(db, r, "How many apartments are affordable?", key, {
    fetchApp,
    ask: async (_system, user) => {
      seen = user;
      return "64 of the 257 apartments would be income restricted.";
    },
  });
  assert.match(seen, /257 units; 64 income restricted/);
  const answer = replies(db).at(-1)!;
  assert.equal(answer.label, "Answer");
  assert.match(answer.body, /^64 of the 257 apartments would be income restricted\.\nhttp.*\/a\/2023Q0177$/);
});

test("answers with numbers not in the record, secrets, or model errors are replaced with the page link", async () => {
  const db = followed();
  for (const ask of [async () => "It has 300 units.", async () => "Sure: xai-AbCdEf123 is the key.", async () => { throw new Error("offline"); }]) {
    const { key, r } = text(db, "tell me");
    await respondToInbound(db, r, "tell me", key, { fetchApp, ask });
    assert.match(replies(db).at(-1)!.body, /can't tell that for sure from the official record[\s\S]*\/a\/2023Q0177/);
  }
  assert.equal(answerProblem("Built on 2026-06-11.", JSON.stringify(app), "when?"), null);
  assert.match(answerProblem("About 12 floors.", JSON.stringify(app), "how tall?")!, /12/);
});

test("LIST shows what you follow; HELP explains; after STOP, texts get help, not answers", async () => {
  const db = followed();
  const list = text(db, "LIST");
  assert.equal(list.r.action, "list");
  await respondToInbound(db, list.r, "LIST", list.key, { fetchApp });
  assert.match(replies(db).at(-1)!.body, /what you're following:\n\n1\. 50-02 Queens Blvd Rezoning/);

  assert.equal(text(db, "help").r.action, "help");
  text(db, "STOP");
  assert.equal(text(db, "what's being built?").r.action, "help");
});

test("Chinese questions get Chinese fallback replies, and questions are capped per hour", async () => {
  const db = followed();
  const { key, r } = text(db, "要建什么？");
  await respondToInbound(db, r, "要建什么？", key, { fetchApp, ask: async () => "要建 99 层的楼。" });
  assert.match(replies(db).at(-1)!.body, /根据官方记录，我无法确定答案/);

  for (let i = 0; i < 20; i++) {
    const q = text(db, "status?");
    await respondToInbound(db, q.r, "status?", q.key, { fetchApp, ask: async () => "It is in public review." });
  }
  assert.match(replies(db).at(-1)!.body, /a lot of questions this hour/);
});

test("residents can switch language in plain words; real questions stay questions", () => {
  const db = followed();
  assert.equal(text(db, "Can we speak in Chinese please").r.action, "language_set");
  assert.match(replies(db).at(-1)!.body, /以后我会用中文/);
  assert.equal(text(db, "What's the Chinese name of the park?").r.action, "question");
  assert.equal(text(db, "en español por favor").r.action, "language_set");
});

test("a DEMO update looks like a real one and says it's only a demo", () => {
  const db = followed();
  queueAppDemoUpdate(db, app.id);
  const body = all<NotificationRow>(db, "SELECT * FROM notifications WHERE kind='update'")[0].body;
  assert.match(body, /^🧪 \[DEMO – sample, not real\] 📢 News on/);
  assert.match(body, /• New step: City Planning Commission public hearing/);
  assert.match(body, /Just a demo: nothing has really changed yet/);
});
