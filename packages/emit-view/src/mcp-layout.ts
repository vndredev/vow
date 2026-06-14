import { asRecord } from "@vow/core";
import { str } from "./helpers.ts";

/**
 * The MCP/channel-health layouts (`mcp: { as }`) → the component the plugin materialises for each. The ONE
 * source `mapNode` (what to render) and `mcpLayouts` (what to materialise) share, so a layout can never
 * render a component the plugin didn't write. One layout today (`status`) — the MCP channel made observable.
 */
export const MCP_LAYOUTS = {
  status: "VowMcpStatus",
} as const;

export type McpLayout = keyof typeof MCP_LAYOUTS;

/** A type guard: `name` is one of the known MCP layouts. */
function isMcpLayout(name: string): name is McpLayout {
  return Object.hasOwn(MCP_LAYOUTS, name);
}

/**
 * Resolve + validate an `mcp: { as }` value (defaults to `status`); throws on an unknown layout, so a
 * typo is a clear build error rather than a dangling import to a never-materialised component.
 */
export function mcpLayout(value: unknown): McpLayout {
  const as = str(asRecord(value)["as"]) || "status";
  if (!isMcpLayout(as)) {
    throw new Error(
      `emit-view: unknown mcp layout "${as}" — use ${Object.keys(MCP_LAYOUTS).join(", ")}`,
    );
  }
  return as;
}
