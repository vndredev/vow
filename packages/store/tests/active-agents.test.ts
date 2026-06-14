import { expect, test } from "vite-plus/test";
import { activeRunsFrom } from "../src/active-agents.ts";

const ISSUE_NUMBER = 42;

/**
 * The active-agents derivation — pure, testable without a DOM or a live store. Pins the
 * "active = run.started without matching run.finished" contract, the latest-phase tracking, and
 * the agent.tool feed accumulation so the cockpit's panel can be wired up without a live agent run.
 */

const START_TS = "2026-06-14T10:00:00.000Z";
const PHASE_TS = "2026-06-14T10:00:05.000Z";
const TOOL_TS = "2026-06-14T10:00:10.000Z";
const FINISH_TS = "2026-06-14T10:00:20.000Z";

test("activeRunsFrom returns [] when the feed is empty", () => {
  expect(activeRunsFrom([])).toEqual([]);
});

test("activeRunsFrom returns [] when no run.started events exist", () => {
  const items = [{ kind: "run.phase", phase: "develop", ts: PHASE_TS }];
  expect(activeRunsFrom(items)).toEqual([]);
});

test("activeRunsFrom surfaces an issue once run.started appears", () => {
  const items = [{ issue: ISSUE_NUMBER, kind: "run.started", ts: START_TS }];
  const runs = activeRunsFrom(items);
  expect(runs).toHaveLength(1);
  expect(runs[0]?.issue).toBe(ISSUE_NUMBER);
});

test("activeRunsFrom removes an issue once its run.finished event lands", () => {
  const items = [
    { issue: ISSUE_NUMBER, kind: "run.started", ts: START_TS },
    { issue: ISSUE_NUMBER, kind: "run.finished", ts: FINISH_TS },
  ];
  expect(activeRunsFrom(items)).toEqual([]);
});

test("activeRunsFrom tracks the latest run.phase per issue", () => {
  const items = [
    { issue: ISSUE_NUMBER, kind: "run.started", ts: START_TS },
    { issue: ISSUE_NUMBER, kind: "run.phase", phase: "worktree", ts: PHASE_TS },
    { issue: ISSUE_NUMBER, kind: "run.phase", phase: "develop", ts: TOOL_TS },
  ];
  const runs = activeRunsFrom(items);
  expect(runs[0]?.phase).toBe("develop");
});

test("activeRunsFrom captures the specialist from run.started.detail", () => {
  const items = [{ detail: "docs-keeper", issue: 99, kind: "run.started", ts: START_TS }];
  const runs = activeRunsFrom(items);
  expect(runs[0]?.specialist).toBe("docs-keeper");
});

test("activeRunsFrom uses empty string when run.started carries no specialist", () => {
  const items = [{ issue: 99, kind: "run.started", ts: START_TS }];
  const runs = activeRunsFrom(items);
  expect(runs[0]?.specialist).toBe("");
});

test("activeRunsFrom accumulates agent.tool events per issue", () => {
  const items = [
    { issue: 7, kind: "run.started", ts: START_TS },
    { detail: "reading foo.ts", issue: 7, kind: "agent.tool", phase: "Read", ts: TOOL_TS },
  ];
  const runs = activeRunsFrom(items);
  expect(runs[0]?.tools).toHaveLength(1);
  expect(runs[0]?.tools[0]?.name).toBe("Read");
  expect(runs[0]?.tools[0]?.summary).toBe("reading foo.ts");
  expect(runs[0]?.tools[0]?.ts).toBe(TOOL_TS);
});

test("activeRunsFrom returns [] tools when no agent.tool events exist", () => {
  const items = [{ issue: 7, kind: "run.started", ts: START_TS }];
  const runs = activeRunsFrom(items);
  expect(runs[0]?.tools).toEqual([]);
});

test("activeRunsFrom re-surfaces an issue when run.started follows run.finished (re-run)", () => {
  const items = [
    { issue: ISSUE_NUMBER, kind: "run.started", ts: START_TS },
    { issue: ISSUE_NUMBER, kind: "run.finished", ts: FINISH_TS },
    { issue: ISSUE_NUMBER, kind: "run.started", ts: TOOL_TS },
  ];
  const runs = activeRunsFrom(items);
  expect(runs).toHaveLength(1);
  expect(runs[0]?.issue).toBe(ISSUE_NUMBER);
});

test("activeRunsFrom resets phase and tools on a re-run", () => {
  const items = [
    { issue: ISSUE_NUMBER, kind: "run.started", ts: START_TS },
    { issue: ISSUE_NUMBER, kind: "run.phase", phase: "develop", ts: PHASE_TS },
    { detail: "old tool", issue: 42, kind: "agent.tool", phase: "Read", ts: PHASE_TS },
    { issue: ISSUE_NUMBER, kind: "run.finished", ts: FINISH_TS },
    { issue: ISSUE_NUMBER, kind: "run.started", ts: TOOL_TS },
  ];
  const runs = activeRunsFrom(items);
  expect(runs).toHaveLength(1);
  expect(runs[0]?.phase).toBe("");
  expect(runs[0]?.tools).toEqual([]);
});

test("activeRunsFrom ignores run.started events with no issue field", () => {
  // The runtime guard (typeof ev.issue === "number") defends against absent values too.
  const items = [{ kind: "run.started", ts: PHASE_TS }];
  expect(activeRunsFrom(items)).toEqual([]);
});

test("activeRunsFrom tracks multiple concurrent active runs independently", () => {
  const items = [
    { issue: 1, kind: "run.started", ts: START_TS },
    { issue: 2, kind: "run.started", ts: START_TS },
    { issue: 1, kind: "run.phase", phase: "develop", ts: PHASE_TS },
    { issue: 2, kind: "run.finished", ts: FINISH_TS },
  ];
  const runs = activeRunsFrom(items);
  expect(runs).toHaveLength(1);
  expect(runs[0]?.issue).toBe(1);
  expect(runs[0]?.phase).toBe("develop");
});
