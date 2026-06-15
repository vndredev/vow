// @vitest-environment node
import { addItem, getItem, listSessions, openPlan, setStatus } from "@vow/plan";
import { claimIssues, toRef } from "../src/plan-ops.ts";
import { expect, test } from "vite-plus/test";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const ISSUE = 42;

test("claimIssues opens a session + transitions the bound ready item to doing", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "vow-plan-ops-"));
  const db = openPlan(dir);
  const item = addItem(db, { issue: ISSUE, title: "work" });
  setStatus(db, item.id, "ready");
  claimIssues(dir, [ISSUE]);
  const fresh = openPlan(dir);
  expect(getItem(fresh, item.id)?.status).toBe("doing");
  expect(listSessions(fresh).map((each) => each.item)).toEqual([item.id]);
});

test("toRef maps an issue's pillar label onto the ref", () => {
  const ref = toRef({
    assignees: [],
    labels: ["area: cli", "pillar:self-planning"],
    number: ISSUE,
    state: "open",
    title: "t",
  });
  expect(ref.pillar).toBe("pillar:self-planning");
});
