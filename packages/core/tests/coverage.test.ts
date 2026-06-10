import { expect, test } from "vite-plus/test";
import { uncoveredScenarios } from "../src/coverage.ts";

test("a claim is covered only by a test named EXACTLY that claim", () => {
  expect(uncoveredScenarios(["rejects empty title"], ["rejects empty title"])).toEqual([]);
  // A substring must NOT cover — that was the false-green the emitter never relies on.
  expect(uncoveredScenarios(["rejects empty title"], ["task: rejects empty title here"])).toEqual([
    "rejects empty title",
  ]);
});

test("a partial overlap does not cover ('adds a task' vs 'readds a task quickly')", () => {
  expect(uncoveredScenarios(["adds a task"], ["readds a task quickly"])).toEqual(["adds a task"]);
});

test("a claim with no matching test is reported uncovered", () => {
  expect(uncoveredScenarios(["computes 5% discount", "is ok"], ["is ok"])).toEqual([
    "computes 5% discount",
  ]);
});

test("a blank claim can never be covered", () => {
  expect(uncoveredScenarios(["", "  "], ["", "  ", "real"])).toEqual(["", "  "]);
});

test("no expected scenarios → nothing uncovered", () => {
  expect(uncoveredScenarios([], ["whatever"])).toEqual([]);
});
