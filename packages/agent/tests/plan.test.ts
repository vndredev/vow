import { branchFor, buildPlan } from "../src/plan.ts";
import { expect, test } from "vite-plus/test";

const issue = { body: "Add the thing to the place.", number: 98, title: "the agent loop" };
const context = { commit: "abc1234", verify: ["`vow smoke` is green"] };

test("buildPlan inlines the task + the always-on gates + the extra verify lines", () => {
  const plan = buildPlan(issue, context);
  expect(plan).toContain("the agent loop (#98)");
  expect(plan).toContain("Add the thing to the place.");
  expect(plan).toContain("vp check");
  expect(plan).toContain("pnpm -r test");
  expect(plan).toContain("vow smoke");
});

test("buildPlan carries the improve discipline — commit stamp, out-of-scope, STOP conditions", () => {
  const plan = buildPlan(issue, context);
  expect(plan).toContain("abc1234");
  expect(plan).toContain("Out of scope");
  expect(plan).toContain("STOP conditions");
});

test("branchFor derives a per-issue branch", () => {
  expect(branchFor(issue)).toBe("vow/issue-98");
});
