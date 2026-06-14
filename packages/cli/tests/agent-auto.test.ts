/* oxlint-disable consistent-type-specifier-style -- one import; a separate type import trips no-duplicate-imports */
import { type RoundOps, advanceStatus, orchestrateRound } from "../src/agent-auto.ts";
/* oxlint-enable consistent-type-specifier-style */
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { expect, test } from "vite-plus/test";
import { finalGates, fixGates } from "../src/agent-run.ts";
import type { LoopStatus } from "@vow/observability";
import { cleanStaleWorktrees } from "../src/agent-worktrees.ts";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { tmpdir } from "node:os";

/** A fake `RoundOps` that records the order of effects, with a SLOW `developBacklog` (resolves on a later
 *  microtask tick) so a test can assert the settle ran CONCURRENTLY with it, not after it. */
function fakeRoundOps(settleableAfter: number): {
  log: string[];
  ops: RoundOps;
  statuses: LoopStatus[];
} {
  const log: string[] = [];
  const statuses: LoopStatus[] = [];
  let settled = false;
  const ops: RoundOps = {
    developBacklog: async () => {
      log.push("develop:start");
      // Yield twice so a concurrent settle interleaves before the develop resolves (a slow develop lane).
      await Promise.resolve();
      await Promise.resolve();
      log.push("develop:done");
    },
    settle: async () => {
      log.push("settle:start");
      await Promise.resolve();
      settled = true;
      log.push("settle:done");
    },
    settleableCount: () => {
      // After the settle merges, fewer PRs remain open — model the live count dropping post-settle.
      if (settled) {
        return 0;
      }
      return settleableAfter;
    },
    writeStatus: (status) => {
      statuses.push(status);
    },
  };
  return { log, ops, statuses };
}

test("fixGates is the FAST per-fix-round set — vp lint + the touched package, NEVER pnpm -r test (#676)", () => {
  // A mapped area scopes the test gate to ONE package; lint is whole-repo (fast). Never the whole-repo suite.
  expect(fixGates("agent")).toEqual(["vp lint", "vp test packages/agent"]);
  expect(fixGates("observability")).toEqual(["vp lint", "vp test packages/observability"]);
  // No mapped package (or no area) -> `vp lint` alone (still fast); CI runs the full suite on the PR.
  expect(fixGates("")).toEqual(["vp lint"]);
  expect(fixGates("studio")).toEqual(["vp lint"]);
  // The whole-repo suite must NEVER be a per-fix-round gate.
  for (const area of ["agent", "observability", "", "studio", "core"]) {
    expect(fixGates(area)).not.toContain("pnpm -r test");
  }
});

test("finalGates is the THOROUGH pre-PR set — vp check + the touched package, WORKTREE-SAFE (no pnpm -r test) (#685)", () => {
  // The thorough gate = `vp check` (full lint + type + format) + the area's package tests; it differs from the
  // Fast `fixGates` only in `vp check` vs `vp lint`, and like it scopes tests to ONE package, never the repo.
  expect(finalGates("agent")).toEqual(["vp check", "vp test packages/agent"]);
  expect(finalGates("observability")).toEqual(["vp check", "vp test packages/observability"]);
  // No mapped package (or no area) -> `vp check` alone; CI runs the full suite on the PR.
  expect(finalGates("")).toEqual(["vp check"]);
  expect(finalGates("studio")).toEqual(["vp check"]);
  // THE #685 FIX: the whole-repo `pnpm -r test` throws in a develop worktree (`.git` is a FILE) and drafted
  // EVERY run -> 0 convergence; the final verify must NEVER invoke it. CI runs the full suite as the backstop.
  for (const area of ["agent", "observability", "", "studio", "core"]) {
    expect(finalGates(area)).not.toContain("pnpm -r test");
  }
});

test("advanceStatus carries the advancing round + LIVE counts (round/backlog/openPrs), running, a timestamp (#673)", () => {
  const round = 3;
  const backlog = 2;
  const openPrs = 4;
  const status = advanceStatus({ attempts: [], round }, { backlog, openPrs });
  expect(status.round).toBe(round);
  expect(status.backlog).toBe(backlog);
  expect(status.openPrs).toBe(openPrs);
  expect(status.running).toBe(true);
  // A fresh ISO-8601 `lastRound` so the cockpit shows when the loop advanced, not a frozen snapshot.
  expect(typeof status.lastRound).toBe("string");
  expect(Number.isNaN(Date.parse(status.lastRound ?? ""))).toBe(false);
});

// A round's backlog issue numbers + the open-PR count the settle starts from — fixtures, named so the strict
// Wall (no magic numbers) holds and the assertions read against the same constants.
const ISSUE_A = 10;
const ISSUE_B = 11;
const ISSUE_C = 12;
const BACKLOG_TWO: readonly number[] = [ISSUE_A, ISSUE_B];
const BACKLOG_THREE: readonly number[] = [ISSUE_A, ISSUE_B, ISSUE_C];
const OPEN_PRS = 2;
const ROUND_ONE = 1;
const ROUND_FIVE = 5;
const MIN_ADVANCE_WRITES = 2;
const SETTLED_OPEN_PRS = 0;

test("orchestrateRound settles CONCURRENTLY with the develop — a green PR never waits for the slow develop (#676)", async () => {
  const { log, ops } = fakeRoundOps(OPEN_PRS);
  await orchestrateRound(ops, { attempts: [], round: ROUND_ONE }, BACKLOG_TWO);
  // The settle STARTS before the (slow) develop finishes — decoupled from the round barrier.
  expect(log.indexOf("settle:start")).toBeLessThan(log.indexOf("develop:done"));
  expect(log).toContain("settle:done");
  expect(log).toContain("develop:done");
});

test("orchestrateRound writes the LIVE status as the round advances — round number + live open-PR count (#673)", async () => {
  const { ops, statuses } = fakeRoundOps(OPEN_PRS);
  await orchestrateRound(ops, { attempts: [], round: ROUND_FIVE }, BACKLOG_THREE);
  // Status is written as the round advances (at least at the start + after settle), not the idle default.
  expect(statuses.length).toBeGreaterThanOrEqual(MIN_ADVANCE_WRITES);
  // Every advance carries the advancing round number + the developing backlog + running:true.
  for (const status of statuses) {
    expect(status.round).toBe(ROUND_FIVE);
    expect(status.backlog).toBe(BACKLOG_THREE.length);
    expect(status.running).toBe(true);
  }
  // The FIRST write saw the open PRs; the LAST (post-settle) reflects the merged-down live count.
  expect(statuses[0]?.openPrs).toBe(OPEN_PRS);
  expect(statuses.at(-1)?.openPrs).toBe(SETTLED_OPEN_PRS);
});

/** Run `git` in `cwd`, silencing output — the worktree-cleanup test sets up a throwaway repo. */
function git(cwd: string, ...args: readonly string[]): void {
  execFileSync("git", [...args], { cwd, stdio: "ignore" });
}

/** A throwaway git repo with one commit, configured so `git worktree add` and `commit` succeed headless. */
function makeRepo(): string {
  const root = mkdtempSync(path.join(tmpdir(), "vow-wt-"));
  git(root, "init", "-q");
  git(root, "config", "user.email", "t@t.t");
  git(root, "config", "user.name", "t");
  git(root, "commit", "--allow-empty", "-q", "-m", "root");
  return root;
}

const ACTIVE_ISSUE = 10;
const STALE_ISSUE = 11;
const ONE_REMOVED = 1;

/** Register a per-issue worktree for `issue` under `root`'s `.vow-worktrees/` and return its path. */
function addWorktree(root: string, issue: number): string {
  const at = path.join(root, ".vow-worktrees", `feat-issue-${issue}`);
  git(root, "worktree", "add", "-B", `feat/issue-${issue}`, at);
  return at;
}

test("cleanStaleWorktrees removes a prior run's leftover but SPARES an active one (#681)", () => {
  const root = makeRepo();
  try {
    // Two leftover per-issue worktrees from a prior run, both registered with git.
    const activeDir = addWorktree(root, ACTIVE_ISSUE);
    const staleDir = addWorktree(root, STALE_ISSUE);
    // The active issue (an in-flight run owns it) is spared; the stale one is removed + its branch freed.
    expect(cleanStaleWorktrees(root, [ACTIVE_ISSUE])).toBe(ONE_REMOVED);
    expect(existsSync(staleDir)).toBe(false);
    expect(existsSync(activeDir)).toBe(true);
    // The freed branch re-adds at the same path — the "already used by worktree" block is gone.
    expect(addWorktree(root, STALE_ISSUE)).toBe(staleDir);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});
