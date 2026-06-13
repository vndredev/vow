import { LOOP_STATUS_IDLE, parseLoopStatus } from "../src/loop-status.ts";
import { expect, test } from "vite-plus/test";
import type { LoopStatus } from "@vow/observability";

/**
 * The store's loop-status parser — it validates the `/__vow/agent-loop/status` JSON wire at runtime (never a
 * blind cast), so a malformed response degrades to the clean idle default. The wire shape is pinned to the
 * producer (`@vow/observability`'s `LoopStatus`), so a drift in the producer fails this consumer's typecheck.
 */

/** The wire shape is pinned to the producer: a parsed status IS `@vow/observability`'s `LoopStatus`. */
type Parsed = ReturnType<typeof parseLoopStatus>;
type Mutual<Left, Right> = Left extends Right ? (Right extends Left ? true : false) : false;
const WIRE_TYPE_PINNED: Mutual<Parsed, LoopStatus> = true;

const ROUND = 3;
const BACKLOG = 5;
const OPEN_PRS = 2;

test("the loop-status wire type is pinned to the producer's LoopStatus", () => {
  expect(WIRE_TYPE_PINNED).toBe(true);
});

test("parseLoopStatus lifts a well-formed status, carrying the optional lastRound", () => {
  const status = parseLoopStatus({
    backlog: BACKLOG,
    lastRound: "2026-06-13T00:00:00.000Z",
    openPrs: OPEN_PRS,
    round: ROUND,
    running: true,
  });
  expect(status).toEqual({
    backlog: BACKLOG,
    lastRound: "2026-06-13T00:00:00.000Z",
    openPrs: OPEN_PRS,
    round: ROUND,
    running: true,
  });
});

test("parseLoopStatus validates every field — a malformed payload degrades to the idle default", () => {
  // A string `running`, a negative round, a fractional count, a non-string lastRound — all default cleanly.
  expect(
    parseLoopStatus({ backlog: -1, lastRound: 5, openPrs: 1.5, round: "x", running: "yes" }),
  ).toEqual({ backlog: 0, openPrs: 0, round: 0, running: false });
});

test("parseLoopStatus is the idle default for a non-object wire (number / array / string)", () => {
  expect(parseLoopStatus(ROUND)).toEqual(LOOP_STATUS_IDLE);
  expect(parseLoopStatus([ROUND, BACKLOG])).toEqual(LOOP_STATUS_IDLE);
  expect(parseLoopStatus("running")).toEqual(LOOP_STATUS_IDLE);
});
