// oxlint-disable prefer-readonly-parameter-types -- this module bridges the mutable Node http req/res objects
import type { IncomingMessage, ServerResponse } from "node:http";
import { TOOL_DOCS } from "@vow/mcp/tools";
import { defined } from "@vow/core";
import { readEvents } from "@vow/observability";

/**
 * The dev MCP/channel health middleware — the `/__vow/mcp/status` surface. Extracted from `dev-api.ts` so
 * the TOOL_DOCS import lives in its own module, keeping `dev-api.ts` under the max-lines gate.
 */

/** A connect-style middleware: read the request, write the response, or pass to the next handler. */
type Middleware = (
  req: IncomingMessage,
  res: ServerResponse,
  next: (err?: unknown) => void,
) => void;

const HTTP_OK = 200;
const MINUTES_5 = 5;
const SECONDS_PER_MINUTE = 60;
const MS_PER_SECOND = 1000;
/** The freshness window that determines `connected` — an event within 5 minutes means the loop/MCP
 *  has been recently active (it records events as it runs), so the channel reads as connected. */
const CONNECTED_TTL_MS = MINUTES_5 * SECONDS_PER_MINUTE * MS_PER_SECOND;

/** The number of tools the vow MCP server registers — the catalogue's length, not a fake. */
const MCP_TOOL_COUNT: number = TOOL_DOCS.length;

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
 * The dev MCP/channel health API — `/__vow/mcp/status`. A plain GET serves the MCP connection health
 * derived from the append-only event feed the loop and MCP record to: `connected` is true when the
 * newest event's `ts` is within the 5-minute freshness window (the loop/MCP was recently active),
 * `lastEvent` is the newest event's `ts` + `kind` (absent when the feed is empty), and `toolCount` is
 * the number of tools registered by the vow MCP server (from the single-source catalogue). Read-only:
 * the status is derived from the feed, never written by the browser. The `useMcpStatus()` store hook
 * polls this on the same 5s interval as the other status surfaces.
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
    const body = { connected, toolCount: MCP_TOOL_COUNT, ...lastEventOf(events) };
    res.statusCode = HTTP_OK;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(body));
  };
}
