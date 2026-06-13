import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * The agent loop's live status — the seam that makes the autonomous loop OBSERVABLE. The loop process
 * (`vow serve --watch`, `vow agent auto`) RECORDS its round state to `.vow/loop-status.json` as it advances;
 * the dev-API READS it (the dev server can't see the loop process's memory, so a status FILE is the channel)
 * and the studio's `useAgentLoopStatus()` hook polls it. Writes are atomic (write-temp-rename) + best-effort:
 * a recording hiccup never breaks the round it observes. Reads are graceful: an absent/malformed file is the
 * `running: false` default (no loop has run yet), never a thrown read.
 */

/** The status file, under the repo's `.vow/` dir (beside the `events.jsonl` the loop also records). */
const STATUS_FILE = "loop-status.json";

/** The loop's live state at the top of (and between) rounds — whether it is running, the current round, the
 *  effective backlog + open-PR counts the round saw, and when the last round advanced (ISO-8601 UTC). The
 *  studio reads it to show whether autonomy is on, what round it's on, and what it is working through. */
export interface LoopStatus {
  // Whether the agent loop is currently running (`vow serve --watch --yes` is up, mid-spiral or idling).
  readonly running: boolean;
  // The round the loop is on (1-based; 0 before the first round advances).
  readonly round: number;
  // The effective backlog this round saw — the within-cap, PR-less issues it develops.
  readonly backlog: number;
  // The open, settleable PRs this round saw — a round with open PRs is never a no-op.
  readonly openPrs: number;
  // When the last round advanced (ISO-8601 UTC), absent before the first round.
  readonly lastRound?: string;
}

/** The `running: false` default — the status when no loop has run yet (the file is absent/unreadable). A
 *  fresh zero state so a reader always has a well-formed `LoopStatus`, never an `undefined` to guard. */
export const LOOP_IDLE: LoopStatus = { backlog: 0, openPrs: 0, round: 0, running: false };

/** The path to the loop-status file under `cwd`'s `.vow/` dir. */
export function loopStatusPath(cwd: string): string {
  return path.join(cwd, ".vow", STATUS_FILE);
}

/** Whether a value is a non-null object — the entry to safely lift the parsed status. */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** A boolean field of a raw status, or `false` when absent/non-boolean. */
function boolField(raw: Readonly<Record<string, unknown>>, key: string): boolean {
  return raw[key] === true;
}

/** A non-negative integer field of a raw status, or `0` when absent/invalid — so a malformed count never
 *  reads as a negative or a `NaN` the studio would render. */
function countField(raw: Readonly<Record<string, unknown>>, key: string): number {
  const value = raw[key];
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return value;
  }
  return 0;
}

/** The optional `lastRound` field, present only when the raw status carried a string timestamp. */
function lastRoundField(raw: Readonly<Record<string, unknown>>): { lastRound?: string } {
  const value = raw["lastRound"];
  if (typeof value === "string") {
    return { lastRound: value };
  }
  return {};
}

/** Lift a parsed JSON value into a `LoopStatus`, validating every field (a real runtime check, not a blind
 *  cast) — a malformed payload degrades to the idle default, never an ill-typed status the studio trusts. */
function liftStatus(raw: unknown): LoopStatus {
  if (!isObject(raw)) {
    return LOOP_IDLE;
  }
  return {
    backlog: countField(raw, "backlog"),
    openPrs: countField(raw, "openPrs"),
    round: countField(raw, "round"),
    running: boolField(raw, "running"),
    ...lastRoundField(raw),
  };
}

/** Parse loop-status JSON text into a `LoopStatus` — the idle default on malformed/non-object JSON (never a
 *  throw). Pure, so the read path is unit-testable without a filesystem. */
export function parseLoopStatus(text: string): LoopStatus {
  try {
    return liftStatus(JSON.parse(text));
  } catch {
    return LOOP_IDLE;
  }
}

/** Read the loop status under `cwd` — the idle default (`running: false`) when the file is absent/unreadable
 *  (no loop has run yet) or malformed. Never throws. */
export function readLoopStatus(cwd: string): LoopStatus {
  try {
    return parseLoopStatus(readFileSync(loopStatusPath(cwd), "utf8"));
  } catch {
    return LOOP_IDLE;
  }
}

/**
 * Record the loop's live status under `cwd` — write to a sibling temp file then rename it over the target,
 * so a reader never sees a half-written file (rename is atomic on a POSIX filesystem). BEST-EFFORT: returns
 * whether it wrote, never throws — recording the loop's state must never break the round it observes. The
 * temp name carries the pid so two processes recording at once never clobber each other's temp file.
 */
export function writeLoopStatus(cwd: string, status: Readonly<LoopStatus>): boolean {
  try {
    const dir = path.join(cwd, ".vow");
    mkdirSync(dir, { recursive: true });
    const target = loopStatusPath(cwd);
    const temp = path.join(dir, `${STATUS_FILE}.${process.pid}.tmp`);
    writeFileSync(temp, JSON.stringify(status));
    renameSync(temp, target);
    return true;
  } catch {
    return false;
  }
}
