/**
 * Live city applications: briefings read only the city's record, and follows text on real changes.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { all, get, openMemoryDb } from "./db.ts";
import { HttpError } from "./lib/util.ts";
import { appAudioView, appScript, checkAppUpdates, checkVersion, importPastedVersion, queueAppDemoUpdate } from "./services/appBriefings.ts";
import type { NotificationRow } from "./services/notifications.ts";
import { createAppFollowCode, followStatus, handleInbound } from "./services/subscriptions.ts";
import type { ZapApplication } from "./services/zap.ts";

const app = (over: Partial<ZapApplication> = {}): ZapApplication => ({
  id: "2023Q0177",
  name: "50-02 Queens Blvd Rezoning",
  brief: "A zoning map amendment to facilitate a new 9-story, ~261,100 sq ft building with 257 DUs (64 MIH).",
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
  ...over,
});

const inbound = (text: string, id: string) => ({ providerEventId: id, handle: "+16465550100", spaceId: null, text, transport: "simulator" as const });
const notes = (db: ReturnType<typeof openMemoryDb>) => all<NotificationRow>(db, "SELECT * FROM notifications ORDER BY created_at, rowid");

test("the briefing reads the city's own fields, with shorthand spelled out", () => {
  const s = appScript(app());
  assert.match(s, /^50-02 Queens Blvd Rezoning\./);
  assert.match(s, /approximately 261,100 square feet/);
  assert.match(s, /257 dwelling units \(64 Mandatory Inclusionary Housing\)/);
  assert.match(s, /Status in the city's record: in public review\./);
  assert.match(s, /Latest milestone: EAS - Community Board Referral, /);
  assert.match(s, /Applicant: 5002 Woodside Development LLC\./);
  assert.match(appScript(app({ brief: null, milestone: null, applicant: null })), /doesn't include a description yet/);
});

test("following a city application: code → confirmation; repeat is harmless; STOP ends it", () => {
  const db = openMemoryDb();
  const fc = createAppFollowCode(db, app(), "en");
  assert.equal(followStatus(db, fc.code).status, "waiting");
  assert.equal(handleInbound(db, inbound(fc.code, "m1")).action, "subscribed");
  assert.equal(followStatus(db, fc.code).status, "confirmed");
  handleInbound(db, inbound(fc.code, "m2"));
  const confirms = notes(db).filter((n) => n.kind === "confirmation");
  assert.equal(confirms.length, 1);
  assert.ok(confirms[0].app_subscription_id);
  assert.match(confirms[0].body, /following the NYC Planning application “50-02 Queens Blvd Rezoning”/);
  assert.match(confirms[0].body, /\/a\/2023Q0177/);

  queueAppDemoUpdate(db, "2023Q0177");
  handleInbound(db, inbound("STOP", "m3"));
  assert.equal(get<{ active: number }>(db, "SELECT active FROM app_subscriptions")!.active, 0);
  assert.ok(notes(db).filter((n) => n.kind === "update").every((n) => n.state === "cancelled"));
});

test("followers are texted once when the city's status or milestone changes, and not for no change", async () => {
  const db = openMemoryDb();
  handleInbound(db, inbound(createAppFollowCode(db, app(), "en").code, "m1"));
  const t0 = Date.now();
  assert.equal(await checkAppUpdates(db, async () => app(), t0), 0);

  const moved = app({ milestone: "CPC Public Hearing", milestone_date: "2026-10-01" });
  assert.equal(await checkAppUpdates(db, async () => moved, t0 + 16 * 60_000), 1);
  assert.equal(await checkAppUpdates(db, async () => moved, t0 + 32 * 60_000), 0);
  const update = notes(db).find((n) => n.kind === "update")!;
  assert.match(update.body, /New milestone: CPC Public Hearing/);

  // a city outage is retried later; a 404 means it left active review and is reported once
  assert.equal(await checkAppUpdates(db, async () => { throw new HttpError(502, "down"); }, t0 + 48 * 60_000), 0);
  assert.equal(await checkAppUpdates(db, async () => { throw new HttpError(404, "gone"); }, t0 + 64 * 60_000), 1);
  assert.match(notes(db).filter((n) => n.kind === "update").at(-1)!.body, /No longer listed as active/);
});

const good = {
  simple_en:
    "The owner of 50-02 Queens Blvd Rezoning wants the city to change the zoning so a 9-story building can go up, about 261,100 square feet with 257 homes. 64 of them would be income restricted. It is in public review. The latest step was EAS - Community Board Referral on June 11, 2026. The official city record is linked on this page.",
  zh: "50-02 Queens Blvd 的申请人希望修改区划，建一栋 9 层、约 261,100 平方英尺的楼，共 257 套住房，其中 64 套限制收入。目前处于公众审议中。最新进展是 2026年6月11日的社区委员会转介。官方记录链接在本页。",
};

test("a Grok version is used only when every number and address matches the city's record", () => {
  assert.deepEqual(checkVersion(app(), good), []);
  // the mistake ElevenLabs' dub actually made: 240,120 became 240,220
  const withSqft = app({ brief: "A new building with 240,120 square feet of residential use at 50-02 Queens Boulevard." });
  assert.match(checkVersion(withSqft, { ...good, zh: "住宅面积 240,220 平方英尺。" }).join(" "), /240220 isn't in the city's record/);
  assert.match(checkVersion(app(), { ...good, zh: good.zh.replace("261,100", "26.11万") }).join(" "), /万/);
  assert.match(checkVersion(app(), { ...good, simple_en: good.simple_en.replace("50-02", "50-20") }).join(" "), /address 50-20/);
});

test("pasted Grok versions: checked ones are read aloud, flagged ones fall back to the city's wording", () => {
  const db = openMemoryDb();
  assert.equal(importPastedVersion(db, app(), JSON.stringify(good), null).status, "ready");
  assert.equal(appAudioView(db, app()).version?.simple_en, good.simple_en);

  const flagged = importPastedVersion(db, app(), "```json\n" + JSON.stringify({ ...good, simple_en: good.simple_en.replace("257", "275") }) + "\n```", null);
  assert.equal(flagged.status, "flagged");
  assert.equal(appAudioView(db, app()).version, null);
  assert.throws(() => importPastedVersion(db, app(), "{}", null), /simple_en and zh/);
});
