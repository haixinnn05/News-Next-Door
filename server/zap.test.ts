import assert from "node:assert/strict";
import { test } from "node:test";
import { summarizeApplication } from "./services/grok.ts";
import { applicationById, communityDistrictClause, includesDistrict, locateApplications, normalizeZapRows, type ZapRow } from "./services/zap.ts";

const row = (over: Partial<ZapRow>): ZapRow => ({
  project_id: "2023Q0177",
  project_name: "50-02 Queens Blvd Rezoning",
  project_brief: "A zoning map amendment.",
  project_status: "Active",
  public_status: "In Public Review",
  primary_applicant: "5002 Woodside Development LLC",
  community_district: "Q02",
  current_milestone_date: "2026-06-11T00:00:00.000",
  actions: "ZM; ZR",
  dcp_visibility: "General Public",
  ...over,
});

test("normalize keeps active public Queens CB2 applications and drops the rest", () => {
  const apps = normalizeZapRows([
    row({}),
    row({ project_id: "hold", project_name: "On hold", project_status: "On-Hold" }),
    row({ project_id: "done", project_name: "Completed", public_status: "Completed" }),
    row({ project_id: "other", project_name: "Other district", community_district: "Q05" }),
    row({ project_id: "private", project_name: "Hidden", dcp_visibility: "Agency Only" }),
    row({ project_id: "shared", project_name: "Shared district", community_district: "Q01,Q02", public_status: "Filed", current_milestone_date: "2026-02-20T00:00:00.000" }),
  ], "Q02");
  assert.deepEqual(
    apps.map((a) => a.id),
    ["2023Q0177", "shared"],
  );
  assert.equal(apps[0].zap_url, "https://zap.planning.nyc.gov/projects/2023Q0177");
  assert.equal(apps[0].milestone_date, "2026-06-11");
  assert.equal(apps[0].districts, "Queens CB 2");
  assert.deepEqual(apps[0].actions, [
    { code: "ZM", label: "Zoning map amendment" },
    { code: "ZR", label: "Zoning text amendment" },
  ]);
  assert.equal(apps[1].districts, "Queens CB 1, Queens CB 2");
  assert.equal(apps[1].public_status, "Filed");
  assert.equal(apps[0].location, null);
  assert.equal(includesDistrict("Q10", "Q01"), false);
  assert.equal(includesDistrict("Q01,Q02", "Q01"), true);
  assert.equal(normalizeZapRows([row({ community_district: "Q10", project_name: "Not Q01" })], "Q01").length, 0);
  assert.equal(normalizeZapRows([row({ community_district: "K01", project_id: "bk", project_name: "Greenpoint" })], "K01")[0]?.districts, "Brooklyn CB 1");
  assert.match(communityDistrictClause("M04"), /community_district = 'M04'/);
  assert.throws(() => communityDistrictClause("Q02; drop"), /Invalid/);
});

test("summarizeApplication rejects an unsupported language before calling Grok", async () => {
  await assert.rejects(
    () => summarizeApplication({ name: "A rezoning", brief: "A building.", public_status: "Filed", applicant: null, districts: "Queens CB 2", location: null, milestone: null, actions: [] }, "de"),
    /supported language/,
  );
});

test("applicationById rejects ids that are not city project ids", async () => {
  await assert.rejects(() => applicationById("Q02; drop"), /Application not found/);
  await assert.rejects(() => applicationById("bk"), /Application not found/);
});

test("locateApplications pins each project at the centroid of its tax lots", () => {
  const [app] = normalizeZapRows([row({ project_id: "2023Q0177", project_name: "50-02 Queens Blvd Rezoning" })], "Q02");
  const [located] = locateApplications(
    [app],
    [
      { project_id: "2023Q0177", bbl: "4022830022" },
      { project_id: "2023Q0177", bbl: "4022830012" },
    ],
    [
      { bbl: "4022830022.00000000", address: "50-02 QUEENS BOULEVARD", latitude: "40.7420", longitude: "-73.9140" },
      { bbl: "4022830012.00000000", address: "50-15 QUEENS BOULEVARD", latitude: "40.7440", longitude: "-73.9160" },
    ],
  );
  assert.equal(located.location?.lot_count, 2);
  assert.ok(Math.abs((located.location?.lat ?? 0) - 40.743) < 1e-9);
  assert.ok(Math.abs((located.location?.lng ?? 0) - -73.915) < 1e-9);
  assert.match(located.location?.label ?? "", /Queens Blvd/);
  assert.match(located.location?.label ?? "", /2 tax lots/);
});
