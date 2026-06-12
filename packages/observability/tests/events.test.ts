// @vitest-environment node
import { expect, test } from "vite-plus/test";
import { parseEvents, readEvents, recordEvent } from "../src/events.ts";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const ISSUE = 42;
const PR = 99;
const TWO = 2;

test("parseEvents lifts each NDJSON line, omitting absent optionals (#497)", () => {
  const text = `{"ts":"2026-06-12T00:00:00Z","kind":"run.started","issue":${ISSUE}}
{"ts":"2026-06-12T00:00:01Z","kind":"pr.merged","pr":${PR}}`;
  expect(parseEvents(text)).toEqual([
    { issue: ISSUE, kind: "run.started", ts: "2026-06-12T00:00:00Z" },
    { kind: "pr.merged", pr: PR, ts: "2026-06-12T00:00:01Z" },
  ]);
});

test("parseEvents is graceful — a malformed or non-object line is skipped, never a throw", () => {
  const text = `{"ts":"t","kind":"run.phase","phase":"develop"}
not json
42
{"ts":"t2","kind":"run.finished","detail":"ok"}`;
  expect(parseEvents(text)).toEqual([
    { kind: "run.phase", phase: "develop", ts: "t" },
    { detail: "ok", kind: "run.finished", ts: "t2" },
  ]);
  expect(parseEvents("")).toEqual([]);
});

test("recordEvent + readEvents round-trip — the writer appends, the reader lifts it back (#497)", () => {
  const cwd = mkdtempSync(path.join(os.tmpdir(), "vow-events-"));
  expect(recordEvent(cwd, "run.started", { issue: ISSUE })).toBe(true);
  expect(recordEvent(cwd, "pr.merged", { pr: PR })).toBe(true);
  const events = readEvents(cwd);
  expect(events).toHaveLength(TWO);
  expect(events[0]).toMatchObject({ issue: ISSUE, kind: "run.started" });
  expect(events[1]).toMatchObject({ kind: "pr.merged", pr: PR });
  // Each carries a stamped ts.
  expect(typeof events[0]?.ts).toBe("string");
});

test("readEvents is empty (never throws) when no hub has recorded yet", () => {
  const cwd = mkdtempSync(path.join(os.tmpdir(), "vow-events-empty-"));
  expect(readEvents(cwd)).toEqual([]);
});
