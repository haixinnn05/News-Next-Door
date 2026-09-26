import assert from "node:assert/strict";
import { test } from "node:test";
import { locateApplications, normalizeZapRows, type ZapRow } from "./services/zap.ts";

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
  ]);
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
});

test("locateApplications pins each project at the centroid of its tax lots", () => {
  const [app] = normalizeZapRows([row({ project_id: "2023Q0177", project_name: "50-02 Queens Blvd Rezoning" })]);
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
