// @vitest-environment node
/* oxlint-disable consistent-type-specifier-style -- one mixed import; a separate type import trips no-duplicate-imports */
import {
  LOOP_IDLE,
  type LoopStatus,
  loopStatusPath,
  parseLoopStatus,
  readLoopStatus,
  writeLoopStatus,
} from "../src/loop-status.ts";
/* oxlint-enable consistent-type-specifier-style */
import { existsSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { expect, test } from "vite-plus/test";
import os from "node:os";
import path from "node:path";

/**
 * The agent-loop status seam — the writer (the loop process) records its live round state atomically; the
 * reader (the dev-API) lifts it back, degrading to the `running: false` idle default when the file is
 * absent/malformed. These pin the round-trip, the atomic write (no temp left behind), and the graceful read.
 */

const ROUND = 3;
const BACKLOG = 5;
const OPEN_PRS = 2;

/** A throwaway `.vow/`-able workspace dir. */
function tempDir(): string {
  return mkdtempSync(path.join(os.tmpdir(), "vow-loop-status-"));
}

test("writeLoopStatus + readLoopStatus round-trip — the writer records, the reader lifts it back", () => {
  const cwd = tempDir();
  const status: LoopStatus = {
    backlog: BACKLOG,
    lastRound: "2026-06-13T00:00:00.000Z",
    openPrs: OPEN_PRS,
    round: ROUND,
    running: true,
  };
  expect(writeLoopStatus(cwd, status)).toBe(true);
  expect(readLoopStatus(cwd)).toEqual(status);
});

test("readLoopStatus is the idle default (running: false) when no loop has run — the file is absent", () => {
  const cwd = tempDir();
  expect(readLoopStatus(cwd)).toEqual(LOOP_IDLE);
});

test("writeLoopStatus is atomic — it leaves no temp file behind, only the target", () => {
  const cwd = tempDir();
  writeLoopStatus(cwd, { backlog: 0, openPrs: 0, round: 1, running: true });
  expect(existsSync(loopStatusPath(cwd))).toBe(true);
  // The write-temp-rename leaves only `loop-status.json` — never a stray `*.tmp` a reader could half-read.
  const left = readdirSync(path.join(cwd, ".vow")).filter((name) => name.endsWith(".tmp"));
  expect(left).toEqual([]);
});

test("parseLoopStatus validates every field — a malformed payload degrades to the idle default", () => {
  // A negative round, a string count, and a missing `running` all degrade — never an ill-typed status.
  expect(parseLoopStatus('{"running":"yes","round":-1,"backlog":"x","openPrs":1.5}')).toEqual({
    backlog: 0,
    openPrs: 0,
    round: 0,
    running: false,
  });
  expect(parseLoopStatus("not json")).toEqual(LOOP_IDLE);
  expect(parseLoopStatus("[1,2,3]")).toEqual(LOOP_IDLE);
});

test("readLoopStatus is graceful — a corrupt status file reads as the idle default, never a throw", () => {
  const cwd = tempDir();
  // A real write first (creates `.vow/`), then corrupt the target — the read must still not throw.
  writeLoopStatus(cwd, { backlog: 0, openPrs: 0, round: 1, running: true });
  writeFileSync(loopStatusPath(cwd), "}{ broken");
  expect(readLoopStatus(cwd)).toEqual(LOOP_IDLE);
});
