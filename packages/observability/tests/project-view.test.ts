import { expect, test } from "vite-plus/test";
import { parseRoadmapView, roadmapViewChecks } from "../src/project-view.ts";
import { NONE } from "../src/none.ts";

test("parseRoadmapView lifts {layout, groupBy} from the gh --jq object", () => {
  expect(parseRoadmapView('{"groupBy":"Status","layout":"ROADMAP_LAYOUT"}')).toEqual({
    groupBy: "Status",
    layout: "ROADMAP_LAYOUT",
  });
});

test("parseRoadmapView is NONE when no roadmap view exists (empty output) or the shape is malformed", () => {
  expect(parseRoadmapView("")).toBeUndefined();
  expect(parseRoadmapView("   ")).toBeUndefined();
  expect(parseRoadmapView("not json")).toBeUndefined();
});

test("roadmapViewChecks flags a missing ROADMAP_LAYOUT view as drift", () => {
  const checks = roadmapViewChecks(NONE);
  expect(checks).toHaveLength(1);
  expect(checks[0]?.status).toBe("drift");
});

test("roadmapViewChecks reports group-by drift when the live view groups by Status, not Milestone", () => {
  const checks = roadmapViewChecks({ groupBy: "Status", layout: "ROADMAP_LAYOUT" });
  // The view exists (ok), the group-by drifts (Status, fixable), the date field + markers are UI-only.
  expect(checks.map((check) => check.status)).toEqual(["ok", "drift", "manual", "manual"]);
  expect(checks[1]?.text).toContain("grouped by Status");
  expect(checks[1]?.text).toContain("Milestone");
});

test("roadmapViewChecks holds when the view is grouped by Milestone — only the UI-only steps remain", () => {
  const checks = roadmapViewChecks({ groupBy: "Milestone", layout: "ROADMAP_LAYOUT" });
  expect(checks.map((check) => check.status)).toEqual(["ok", "ok", "manual", "manual"]);
});

test("roadmapViewChecks names 'nothing' when the live view is ungrouped", () => {
  const checks = roadmapViewChecks({ groupBy: "", layout: "ROADMAP_LAYOUT" });
  expect(checks[1]?.text).toContain("grouped by nothing");
});
