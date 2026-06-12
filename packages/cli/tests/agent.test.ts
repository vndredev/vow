import { AGENT_SUBCOMMANDS, agentHelp, agentRouteNames } from "../src/agent.ts";
import { DEFAULT_MAX_ROUNDS, maxRoundsOf } from "../src/agent-auto.ts";
import { expect, test } from "vite-plus/test";
import {
  failedResult,
  flagValue,
  flagValueless,
  issueArg,
  issueNumbers,
  mergeFallback,
  parseRun,
  parseRunAll,
  phaseLine,
  reconcileAfterMerge,
} from "../src/agent-run.ts";
import { providerFor } from "@vow/agent";

const ISSUE = 42;
const FIVE = 5;
const SEVEN = 7;

test("issueArg reads a positive issue number, else 0 for a missing/non-numeric/non-positive arg", () => {
  expect(issueArg(["plan", String(ISSUE)])).toBe(ISSUE);
  expect(issueArg(["plan"])).toBe(0);
  expect(issueArg(["plan", "abc"])).toBe(0);
  expect(issueArg(["plan", "-3"])).toBe(0);
  expect(issueArg(["plan", "5.5"])).toBe(0);
});

const FIRST = 7;
const SECOND = 9;

test("issueArg finds the first positive integer past the sub-command, even after a flag (flag-first run)", () => {
  expect(issueArg(["run", "--provider", "codex", String(ISSUE)])).toBe(ISSUE);
  expect(issueArg(["merge", "--json", String(ISSUE)])).toBe(ISSUE);
  expect(issueArg(["run", "--auth", "api", String(FIRST), String(SECOND)])).toBe(FIRST);
});

test("flagValue reads the value after a flag, else empty for a missing flag or a trailing flag", () => {
  expect(flagValue(["run", "5", "--provider", "codex"], "--provider")).toBe("codex");
  expect(flagValue(["run", "5", "--dry-run"], "--provider")).toBe("");
  expect(flagValue(["run", "5", "--provider"], "--provider")).toBe("");
});

test("flagValueless is true only when the flag is present but its value is missing or another flag", () => {
  expect(flagValueless(["run", "5", "--provider"], "--provider")).toBe(true);
  expect(flagValueless(["run", "5", "--provider", "--json"], "--provider")).toBe(true);
  expect(flagValueless(["run", "5", "--provider", "codex"], "--provider")).toBe(false);
  expect(flagValueless(["run", "5", "--json"], "--provider")).toBe(false);
});

test("parseRun accepts a flag-first issue and resolves the provider (the common flag-first invocation)", () => {
  const args = parseRun(["run", "--provider", "codex", String(ISSUE)]);
  expect(args).toEqual({
    auth: "subscription",
    issue: ISSUE,
    json: false,
    provider: providerFor("codex"),
  });
});

test("parseRun blames the missing value, not the provider, when --provider has no value", () => {
  expect(parseRun(["run", String(ISSUE), "--provider", "--json"])).toBe(
    "vow agent run: --provider needs a value",
  );
  expect(parseRun(["run", String(ISSUE), "--provider"])).toBe(
    "vow agent run: --provider needs a value",
  );
});

test("parseRunAll blames the missing value, not the provider, when --provider has no value", () => {
  expect(parseRunAll(["run-all", "1", "2", "--provider", "--json"])).toBe(
    "vow agent run-all: --provider needs a value",
  );
  expect(parseRunAll(["run-all", "1", "--provider"])).toBe(
    "vow agent run-all: --provider needs a value",
  );
});

test("issueNumbers collects positive numeric args, dropping flags + non-numbers", () => {
  expect(issueNumbers(["run-all", "1", "2", "abc", "--provider", "codex", "3"]).join(",")).toBe(
    "1,2,3",
  );
  expect(issueNumbers(["run-all"])).toEqual([]);
});

test("parseRunAll DEDUPES issue numbers — `run-all 5 5` spawns ONE lane (no shared-worktree collision)", () => {
  // Two lanes for one issue derive the same branch + worktree path; the loser's teardown would force-remove
  // The winner's live worktree. Deduping at parse time means a duplicated arg can never spawn the collision.
  const parsed = parseRunAll(["run-all", "5", "5", "7", "5"]);
  expect(typeof parsed).not.toBe("string");
  if (typeof parsed !== "string") {
    expect([...parsed.issues]).toEqual([FIVE, SEVEN]);
  }
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

test("mergeFallback judges a non-zero gh merge by the PR's MERGED state, not the exit code (#468)", () => {
  // A leftover worktree can block `--delete-branch`, so gh exits non-zero AFTER the merge landed; a MERGED
  // PR is a success despite that — surfaced as a cleanup warning, never a re-raised failure.
  const err = new Error("failed to delete local branch fix/x: used by worktree");
  expect(mergeFallback(ISSUE, true, err)).toBe(
    `pr #${ISSUE}: merged — gh cleanup warning: failed to delete local branch fix/x: used by worktree`,
  );
  // A genuinely-unmerged pr (gh failed BEFORE the merge) returns "" — the caller re-raises the real error.
  expect(mergeFallback(ISSUE, false, err)).toBe("");
});

test("reconcileAfterMerge is best-effort — a board-sync throw never reports a succeeded merge as failed (#466)", () => {
  // The merge is load-bearing; the board reconcile is advisory. A `gh project` hiccup must surface as a
  // Warning the caller prints, NOT a propagated throw that reddens a merge that already landed.
  expect(reconcileAfterMerge(ISSUE, () => "board: 1 reconciled, 63 matched")).toBe(
    "board: 1 reconciled, 63 matched",
  );
  expect(
    reconcileAfterMerge(ISSUE, () => {
      throw new Error("gh project: HTTP 502");
    }),
  ).toBe(`pr #${ISSUE}: merged — board sync skipped: gh project: HTTP 502`);
});

const ROUNDS = 4;

test("maxRoundsOf reads a positive --max-rounds, else the default safety cap (the loop's round bound)", () => {
  expect(maxRoundsOf(["auto", "--max-rounds", String(ROUNDS)])).toBe(ROUNDS);
  expect(maxRoundsOf(["auto"])).toBe(DEFAULT_MAX_ROUNDS);
  expect(maxRoundsOf(["auto", "--max-rounds", "0"])).toBe(DEFAULT_MAX_ROUNDS);
  expect(maxRoundsOf(["auto", "--max-rounds", "abc"])).toBe(DEFAULT_MAX_ROUNDS);
});

test("the agent-subcommand catalogue covers exactly the routes — help can't drift from what runs", () => {
  const cataloguedNames = AGENT_SUBCOMMANDS.map((sub) => sub.name).toSorted();
  expect(cataloguedNames).toEqual(agentRouteNames().toSorted());
});

test("agentHelp lists every agent sub-command with its summary (the front door surfaces the whole loop)", () => {
  const help = agentHelp();
  for (const sub of AGENT_SUBCOMMANDS) {
    expect(help).toContain(`vow agent ${sub.name}`);
    expect(help).toContain(sub.summary);
  }
});
