import { asNumber, isObject } from "./guards.ts";
import type { LoopStatus } from "@vow/observability";

/**
 * The agent-loop-status concern of `@vow/store` — the runtime parser that turns a `/__vow/agent-loop/status`
 * JSON response into a validated `LoopStatus`. The shape is `@vow/observability`'s `LoopStatus` itself (the
 * producer of the wire), imported type-only — a `type` import is erased, so it stays a downward L2 -> L0 edge
 * with no node code in the browser bundle, yet a drift in the producer's shape now fails this parser's
 * typecheck. Read-only: the status is produced by the loop process, never the browser.
 */

/** The validated agent-loop status (the public `@vow/store` type the studio binds to). */
export type LoopStatusItem = LoopStatus;

/** The idle default — the loop is off (no loop has run, or the fetch failed). A well-formed zero state so a
 *  view always has a `LoopStatusItem`, never an `undefined` to guard. */
export const LOOP_STATUS_IDLE: LoopStatusItem = {
  backlog: 0,
  openPrs: 0,
  round: 0,
  running: false,
};

/** A non-negative integer field of a raw status, or `0` when absent/invalid — so a malformed count never
 *  reads as a negative or a `NaN` the studio would render. */
function count(value: unknown): number {
  const num = asNumber(value);
  if (Number.isInteger(num) && num >= 0) {
    return num;
  }
  return 0;
}

/** Add the optional `lastRound` to a base status, present only when the raw value carried a string. */
function withLastRound(base: Omit<LoopStatusItem, "lastRound">, value: unknown): LoopStatusItem {
  if (typeof value === "string") {
    return { ...base, lastRound: value };
  }
  return base;
}

/** Parse a `/__vow/agent-loop/status` JSON value into a validated `LoopStatusItem`, defaulting any missing
 *  or malformed field — so a non-object / malformed response degrades to the clean idle default. */
export function parseLoopStatus(value: unknown): LoopStatusItem {
  if (!isObject(value)) {
    return LOOP_STATUS_IDLE;
  }
  const base = {
    backlog: count(value["backlog"]),
    openPrs: count(value["openPrs"]),
    round: count(value["round"]),
    running: value["running"] === true,
  } as const;
  return withLastRound(base, value["lastRound"]);
}
