import { asNumber, isObject } from "./guards.ts";
import { hasApi, okJson } from "./net.ts";
import { VOW_API } from "@vow/db/routes";
import { reactive } from "vue";

/**
 * The MCP/channel-health-status concern of `@vow/store` — the runtime parser that turns a
 * `/__vow/mcp/status` JSON response into a validated `McpStatusItem`. The three fields are derived by the
 * dev API: `connected` from the freshness of the event feed, `toolCount` from the MCP catalogue, and
 * `lastEvent` from the feed's newest entry. Read-only: the status is observed, never written by the browser.
 */

/** The last event on the feed — the kind + ISO timestamp the MCP health indicator shows. */
export interface McpLastEvent {
  readonly kind: string;
  readonly ts: string;
}

/** The validated MCP/channel health status the `useMcpStatus` hook exposes. */
export interface McpStatusItem {
  readonly connected: boolean;
  readonly toolCount: number;
  readonly lastEvent?: McpLastEvent;
}

/** The disconnected default — no loop/MCP has run yet, or the fetch failed. A well-formed zero state so
 *  a view always has a `McpStatusItem`, never an absent value to guard against. */
export const MCP_STATUS_DISCONNECTED: McpStatusItem = {
  connected: false,
  toolCount: 0,
};

/** A non-negative integer tool count, or `0` when the raw value is absent/invalid. */
function toolCount(value: unknown): number {
  const num = asNumber(value);
  if (Number.isInteger(num) && num >= 0) {
    return num;
  }
  return 0;
}

/** Add the optional `lastEvent` to a base status when the raw value carries both a string `ts` and `kind`. */
function withLastEvent(base: Omit<McpStatusItem, "lastEvent">, value: unknown): McpStatusItem {
  if (!isObject(value)) {
    return base;
  }
  const { ts, kind } = value;
  if (typeof ts !== "string" || ts === "" || typeof kind !== "string" || kind === "") {
    return base;
  }
  return { ...base, lastEvent: { kind, ts } };
}

/** Parse a `/__vow/mcp/status` JSON value into a validated `McpStatusItem`, defaulting any missing
 *  or malformed field — so a non-object / malformed response degrades to the clean disconnected default. */
export function parseMcpStatus(value: unknown): McpStatusItem {
  if (!isObject(value)) {
    return MCP_STATUS_DISCONNECTED;
  }
  const base = {
    connected: value["connected"] === true,
    toolCount: toolCount(value["toolCount"]),
  } as const;
  return withLastEvent(base, value["lastEvent"]);
}

/** The shared reactive MCP/channel health status — one object the studio binds to, assigned field-by-field
 *  on each poll so Vue tracks the change. Starts disconnected until the first fetch lands. */
export const mcpStatus = reactive<McpStatusItem>({ ...MCP_STATUS_DISCONNECTED });

/** The fetch state the MCP-status view reads to distinguish loading / failed. */
export const mcpStatusState = reactive({ error: false, loading: false });

async function fetchMcpStatus(): Promise<{ ok: boolean; status: McpStatusItem }> {
  try {
    return { ok: true, status: parseMcpStatus(await okJson(VOW_API.mcp)) };
  } catch {
    return { ok: false, status: MCP_STATUS_DISCONNECTED };
  }
}

/** Pull the MCP/channel health status from `/__vow/mcp/status` and copy it into the shared reactive
 *  object, driving `mcpStatusState` so the view can show a loading / error branch. */
export async function loadMcpStatus(): Promise<void> {
  if (!hasApi) {
    return;
  }
  mcpStatusState.loading = true;
  const result = await fetchMcpStatus();
  mcpStatusState.error = !result.ok;
  mcpStatusState.loading = false;
  if (result.ok) {
    Object.assign(mcpStatus, MCP_STATUS_DISCONNECTED, result.status);
  }
}
