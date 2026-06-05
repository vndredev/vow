import { expect, test } from "vite-plus/test";
import { uncoveredScenarios } from "../src/coverage.ts";

test("a claim with a matching test name is covered", () => {
  expect(uncoveredScenarios(["rejects empty title"], ["task: rejects empty title here"])).toEqual(
    [],
  );
});

test("a claim with no matching test is reported uncovered", () => {
  expect(uncoveredScenarios(["computes 5% discount", "is ok"], ["proves is ok"])).toEqual([
    "computes 5% discount",
  ]);
});

test("no expected scenarios → nothing uncovered", () => {
  expect(uncoveredScenarios([], ["whatever"])).toEqual([]);
});
