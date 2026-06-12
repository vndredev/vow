import { DEFAULT_MAX_ROUNDS, maxRoundsOf } from "../src/agent-auto.ts";
import { expect, test } from "vite-plus/test";
import { failedResult, flagValue, issueArg, issueNumbers, phaseLine } from "../src/agent-run.ts";

const ISSUE = 42;

test("issueArg reads a positive issue number, else 0 for a missing/non-numeric/non-positive arg", () => {
  expect(issueArg(["plan", String(ISSUE)])).toBe(ISSUE);
  expect(issueArg(["plan"])).toBe(0);
  expect(issueArg(["plan", "abc"])).toBe(0);
  expect(issueArg(["plan", "-3"])).toBe(0);
  expect(issueArg(["plan", "5.5"])).toBe(0);
});

test("flagValue reads the value after a flag, else empty for a missing flag or a trailing flag", () => {
  expect(flagValue(["run", "5", "--provider", "codex"], "--provider")).toBe("codex");
  expect(flagValue(["run", "5", "--dry-run"], "--provider")).toBe("");
  expect(flagValue(["run", "5", "--provider"], "--provider")).toBe("");
});

test("issueNumbers collects positive numeric args, dropping flags + non-numbers", () => {
  expect(issueNumbers(["run-all", "1", "2", "abc", "--provider", "codex", "3"]).join(",")).toBe(
    "1,2,3",
  );
  expect(issueNumbers(["run-all"])).toEqual([]);
});

test("phaseLine is JSON for an LLM/studio, human text for the terminal", () => {
  expect(phaseLine(ISSUE, "develop", true)).toBe(`{"issue":${ISSUE},"phase":"develop"}`);
  expect(phaseLine(ISSUE, "develop", false)).toBe(`  [#${ISSUE}] develop`);
});

test("failedResult turns a thrown develop into a failed lane (so one bad worktree never aborts the fleet)", () => {
  const human = failedResult(ISSUE, new Error("git worktree add failed"), false);
  expect(human.ok).toBe(false);
  expect(human.report).toBe(`issue #${ISSUE}: failed to develop — git worktree add failed`);
  const json = failedResult(ISSUE, new Error("boom"), true);
  expect(json.ok).toBe(false);
  expect(json.report).toBe(`{"issue":${ISSUE},"ok":false}`);
  expect(failedResult(ISSUE, "not an error", false).report).toBe(
    `issue #${ISSUE}: failed to develop — not an error`,
  );
});

const ROUNDS = 4;

test("maxRoundsOf reads a positive --max-rounds, else the default safety cap (the loop's round bound)", () => {
  expect(maxRoundsOf(["auto", "--max-rounds", String(ROUNDS)])).toBe(ROUNDS);
  expect(maxRoundsOf(["auto"])).toBe(DEFAULT_MAX_ROUNDS);
  expect(maxRoundsOf(["auto", "--max-rounds", "0"])).toBe(DEFAULT_MAX_ROUNDS);
  expect(maxRoundsOf(["auto", "--max-rounds", "abc"])).toBe(DEFAULT_MAX_ROUNDS);
});
