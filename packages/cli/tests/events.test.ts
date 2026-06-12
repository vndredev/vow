// @vitest-environment node
import { eventContext, formatEvent } from "../src/events.ts";
import { expect, test } from "vite-plus/test";

const ISSUE = 42;
const PR = 99;

test("eventContext joins the ids / phase / detail an event carries, dropping absent ones (#497)", () => {
  expect(eventContext({ issue: ISSUE, kind: "run.phase", phase: "develop", ts: "t" })).toBe(
    `  #${ISSUE} · develop`,
  );
  expect(eventContext({ kind: "pr.merged", pr: PR, ts: "t" })).toBe(`  pr#${PR}`);
  expect(eventContext({ kind: "run.started", ts: "t" })).toBe("");
});

test("formatEvent is `<ts>  <kind>  <context>` — the trace line shape (#497)", () => {
  expect(
    formatEvent({ detail: "ok", issue: ISSUE, kind: "run.finished", ts: "2026-06-12T00:00:00Z" }),
  ).toBe(`2026-06-12T00:00:00Z  run.finished  #${ISSUE} · ok`);
  expect(formatEvent({ kind: "run.started", ts: "2026-06-12T00:00:00Z" })).toBe(
    "2026-06-12T00:00:00Z  run.started",
  );
});
