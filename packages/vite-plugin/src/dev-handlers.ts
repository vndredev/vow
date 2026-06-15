// oxlint-disable prefer-readonly-parameter-types -- these handlers bridge the mutable Node http req/res objects
import type { IncomingMessage, ServerResponse } from "node:http";
import { openPlan, planSnapshot } from "@vow/plan";
import { TOOL_DOCS } from "@vow/mcp/tools";
import { defined } from "@vow/core";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { readEvents } from "@vow/observability";

/**
 * The dev-API GET handlers extracted from `dev-api.ts` — the MCP/channel health surface (`/__vow/mcp/status`)
 * and the local-plan surface (`/__vow/plan`). Each pulls a third-party import (`@vow/mcp`'s catalogue,
 * `@vow/plan`'s DB) that would push `dev-api.ts` over the max-lines + max-dependencies gates, so they live
 * here. Both are read-only: the status is derived from the event feed; the plan is driven by the agent side.
 */

/** A connect-style middleware: read the request, write the response, or pass to the next handler. */
type Middleware = (
  req: IncomingMessage,
  res: ServerResponse,
  next: (err?: unknown) => void,
) => void;

const HTTP_OK = 200;
const HTTP_ERROR = 500;
const MINUTES_5 = 5;
const SECONDS_PER_MINUTE = 60;
const MS_PER_SECOND = 1000;

/** The freshness window that determines `connected` — an event within 5 minutes means the loop/MCP has
 *  been recently active (it records events as it runs), so the channel reads as connected. */
const CONNECTED_TTL_MS = MINUTES_5 * SECONDS_PER_MINUTE * MS_PER_SECOND;

/** The number of tools the vow MCP server registers — the catalogue's length, not a fake. */
const MCP_TOOL_COUNT: number = TOOL_DOCS.length;

/** The error message of an unknown throw — a string guard, never a cast to `Error`. */
function errorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

/** Write a JSON body at a status — the one place these handlers touch the mutable response. */
function writeJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

/** The age of the newest event in `events`, or `Infinity` when the feed is empty. */
function ageOf(events: ReturnType<typeof readEvents>): number {
  const last = events.at(-1);
  if (!defined(last)) {
    return Number.POSITIVE_INFINITY;
  }
  return Date.now() - new Date(last.ts).getTime();
}

/** The `{ ts, kind }` of the newest event in `events`, or an absent field when the feed is empty. */
function lastEventOf(events: ReturnType<typeof readEvents>): Record<string, unknown> {
  const last = events.at(-1);
  if (!defined(last)) {
    return {};
  }
  return { lastEvent: { kind: last.kind, ts: last.ts } };
}

/**
 * The dev MCP/channel health API — `/__vow/mcp/status`. A plain GET serves the MCP connection health derived
 * from the append-only event feed the loop and MCP record to: `connected` is true when the newest event's
 * `ts` is within the 5-minute freshness window, `lastEvent` is the newest event's `ts` + `kind` (absent when
 * the feed is empty), and `toolCount` is the number of tools the vow MCP server registers. Read-only: the
 * status is derived from the feed, never written by the browser.
 */
export function mcpStatusApi(cwd: string): Middleware {
  return (req, res, next) => {
    if ((req.method ?? "GET") !== "GET") {
      next();
      return;
    }
    const events = readEvents(cwd);
    const age = ageOf(events);
    const connected = Number.isFinite(age) && age <= CONNECTED_TTL_MS;
    writeJson(res, HTTP_OK, { connected, toolCount: MCP_TOOL_COUNT, ...lastEventOf(events) });
  };
}

/**
 * The dev local-plan API — `/__vow/plan`. A plain GET serves the local plan snapshot (`@vow/plan`'s
 * `planSnapshot`: every item + the ready-queue ids + the blocked set) from `<root>/.vow/plan.db`. The DB
 * handle is opened once at mount (the `.vow` dir ensured, an absent DB created + migrated empty), then
 * reused — SQLite sees the MCP / agent / loop process's committed writes on each read. A read failure
 * answers 500 rather than crashing the dev server. Read-only: the plan is driven by the agent side.
 */
export function planApi(root: string): Middleware {
  mkdirSync(path.join(root, ".vow"), { recursive: true });
  const db = openPlan(root);
  return (req, res, next) => {
    if ((req.method ?? "GET") !== "GET") {
      next();
      return;
    }
    try {
      writeJson(res, HTTP_OK, planSnapshot(db));
    } catch (error) {
      writeJson(res, HTTP_ERROR, { error: errorMessage(error) });
    }
  };
}
