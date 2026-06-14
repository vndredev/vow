import type { Attr, Component, UiNode } from "./types.ts";
import { bound, comp } from "./helpers.ts";
import { errorMessage, statusMessage } from "./status-message.ts";
import { renderVueSfc } from "@vow/component";

/**
 * The live MCP/channel-health SFC (`useMcpStatus`) — the `status` layout. It is a fixed component the
 * plugin materialises (`map-node.ts`'s `mcp:` node points at it). It reads `/__vow/mcp/status` live (no
 * baked data): `useMcpStatus` polls the health the dev API derives from the event feed — `connected` from
 * freshness (a recent event → active channel), `toolCount` from the MCP catalogue, `lastEvent` from the
 * feed's newest entry. The studio cockpit binds to it via `mcp: { as: status }` in a `.vow.md`.
 *
 * It composes vow PRIMITIVES — a `Badge` for the channel state (tone by `connected`) and the `Stats`/`Stat`
 * stat-card grid for the health metrics — so it inherits the design language (the `.vow-badge`/`.vow-stat`
 * theme parts) exactly like the loop-status element, never bespoke classed `<div>`s whose CSS doesn't exist.
 *
 * Read-only: the status is derived from the event feed and the MCP catalogue, never the browser.
 */

/** The setup line the MCP-status SFC opens with — the live status object and its fetch state. */
const MCP_SETUP_LINE = `const { status, state } = useMcpStatus();`;

/** The setup helper that formats an ISO `ts` to HH:MM:SS — the same clock the event trace uses. */
const MCP_TIME_HELPER: readonly string[] = [
  MCP_SETUP_LINE,
  `function time(ts: string): string {`,
  `  return new Date(ts).toTimeString().slice(0, 8);`,
  `}`,
];

/** A static-class element node with the given tag and children. */
function classed(tag: string, cls: string, children: readonly UiNode[]): UiNode {
  return {
    attrs: [{ kind: "static", name: "class", value: cls }],
    children: [...children],
    kind: "element",
    tag,
  };
}

/** One channel-state `<Badge>` — `connected` → "Connected" (success), the `!connected` branch →
 *  "Disconnected" (neutral); the soft variant the rest of the studio uses. */
function stateBadge(cond: string, tone: string, label: string): UiNode {
  return comp(
    "Badge",
    [
      { expr: cond, kind: "cond", type: "if" },
      { kind: "static", name: "label", value: label },
      { kind: "static", name: "tone", value: tone },
    ],
    [],
  );
}

/** The channel-state header — the connected Badge XOR the disconnected Badge, one truth at a time. */
function header(): UiNode {
  return classed("header", "vow-mcp__head", [
    stateBadge("status.connected", "success", "Connected"),
    stateBadge("!status.connected", "neutral", "Disconnected"),
  ]);
}

/** The tool-count `<Stat>` — the number of tools the vow MCP server registers, from the catalogue. */
function toolCountStat(): UiNode {
  return comp(
    "Stat",
    [bound("value", "status.toolCount"), { kind: "static", name: "label", value: "Tools" }],
    [],
  );
}

/** The last-event time `<Stat>` — rendered only when the feed has at least one event; absent until then. */
function lastEventStat(): UiNode {
  const attrs: Attr[] = [
    { expr: "status.lastEvent", kind: "cond", type: "if" },
    bound("value", "time(status.lastEvent.ts)"),
    bound("label", "status.lastEvent.kind"),
  ];
  return comp("Stat", attrs, []);
}

/** The metric grid — a `<Stats>` of tool count + optional last-event. */
function metrics(): UiNode {
  return comp("Stats", [], [toolCountStat(), lastEventStat()]);
}

/** The two fetch-state messages the MCP status shows in place of content. */
function mcpEmptyStates(): readonly UiNode[] {
  return [
    statusMessage("state.loading && !state.error", "Loading…"),
    errorMessage("state.error", "Couldn't load the MCP status"),
  ];
}

/** The MCP-status panel — the channel-state header + metric grid, shown once the first fetch settles
 *  cleanly, with the loading / failed messages in its place until then. */
function mcpPanel(): UiNode {
  return classed("section", "vow-mcp", [
    {
      attrs: [
        { kind: "static", name: "class", value: "vow-mcp__body" },
        { expr: "!state.loading && !state.error", kind: "cond", type: "if" },
      ],
      children: [header(), metrics()],
      kind: "element",
      tag: "div",
    },
    ...mcpEmptyStates(),
  ]);
}

/**
 * The MCP/channel-health component — a fixed `<VowMcpStatus>` reading the live health status
 * (`useMcpStatus`, derived from the event feed). No baked data: it polls `/__vow/mcp/status`.
 * Renders the channel state (connected / disconnected) as a `<Badge>` and the health metrics
 * (tool count + last event) as a `<Stats>` stat-card grid; the cockpit binds to it via `mcp: { as: status }`.
 */
export function emitMcpStatusSfc(): string {
  const component: Component = {
    doc: [
      "Generated — the vow MCP/channel health status, read live from /__vow/mcp/status. Do not edit.",
    ],
    imports: [
      { from: "@vow/store", names: ["useMcpStatus"] },
      { default: "Badge", from: "./Badge.vue" },
      { default: "Stats", from: "./Stats.vue" },
      { default: "Stat", from: "./Stat.vue" },
    ],
    name: "VowMcpStatus",
    setup: MCP_TIME_HELPER,
    view: mcpPanel(),
  };
  return renderVueSfc(component);
}
