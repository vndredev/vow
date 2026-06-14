/* oxlint-disable consistent-type-specifier-style -- one import; a separate type import trips no-duplicate-imports */
import { type RoundOps, advanceStatus, orchestrateRound } from "../src/agent-auto.ts";
/* oxlint-enable consistent-type-specifier-style */
import { expect, test } from "vite-plus/test";
import type { LoopStatus } from "@vow/observability";
import { fixGates } from "../src/agent-run.ts";

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
