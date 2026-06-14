import type { Attr, Component, UiNode } from "./types.ts";
import { bound, comp, txt } from "./helpers.ts";
import { emptyStates } from "./status-message.ts";
import { renderVueSfc } from "@vow/component";

/**
 * The live active-agents panel SFC (`useEvents` + `activeRunsFrom`) — the `agents` layout. It is a
 * fixed component the plugin materialises (`map-node.ts`'s `loop:` node points at it for `as: agents`).
 * Derives which agent runs are actively in flight from the event feed: an issue is "active" from its
 * `run.started` until a matching `run.finished`, with the latest `run.phase` and the `agent.tool`
 * events forming the per-agent live tool-feed. The cockpit binds to it via `loop: { as: agents }`.
 *
 * It composes vow PRIMITIVES — a `Badge` per run (issue · specialist · phase) inside a `Card`, and a
 * `Table` of `TableCell` columns (timestamp · tool name · summary) per `agent.tool` event — so it
 * inherits the design language (`.vow-badge` / `.vow-table` / `.vow-card`) exactly like the trace and
 * loop-status, never bespoke divs whose CSS rule doesn't exist. 100% tokens throughout.
 *
 * The per-agent `agent.tool` events are emitted by the sibling issue; until that lands the tool feed
 * inside each card shows "Waiting for tool events…" (a well-formed zero state, never a broken render).
 */

/** The setup the agents-panel SFC opens with — the event feed, the active-run derivation, and the
 *  two helper functions the card rows evaluate: a `ts` → HH:MM:SS clock and a tool-name → tone map. */
const AGENTS_SETUP: readonly string[] = [
  `const { items, state } = useEvents();`,
  `const runs = computed(() => activeRunsFrom(items));`,
  `function time(ts: string): string {`,
  `  return new Date(ts).toTimeString().slice(0, 8);`,
  `}`,
  `function toolTone(name: string): string {`,
  `  if (name === "Edit" || name === "Write") { return "accent"; }`,
  `  return "neutral";`,
  `}`,
];

/** A static-class element node. */
function classed(tag: string, cls: string, children: readonly UiNode[]): UiNode {
  return {
    attrs: [{ kind: "static", name: "class", value: cls }],
    children: [...children],
    kind: "element",
    tag,
  };
}

/** The issue-number `<Badge>` — always present, neutral tone, monospace `#N` label. */
function issueBadge(): UiNode {
  return comp(
    "Badge",
    [bound("label", `\`#\${run.issue}\``), { kind: "static", name: "tone", value: "neutral" }],
    [],
  );
}

/** The specialist `<Badge>` — rendered only when the run carries one (the sibling issue feeds it). */
function specialistBadge(): UiNode {
  return comp(
    "Badge",
    [
      { expr: "run.specialist", kind: "cond", type: "if" },
      bound("label", "run.specialist"),
      { kind: "static", name: "tone", value: "accent" },
    ],
    [],
  );
}

/** The current-phase `<Badge>` — rendered only when at least one `run.phase` event has landed. */
function phaseBadge(): UiNode {
  return comp(
    "Badge",
    [
      { expr: "run.phase", kind: "cond", type: "if" },
      bound("label", "run.phase"),
      { kind: "static", name: "tone", value: "neutral" },
    ],
    [],
  );
}

/** The per-agent header — issue + specialist + phase as a `<CardHeader>` row of `<Badge>`s. */
function agentHeader(): UiNode {
  return comp(
    "CardHeader",
    [{ kind: "static", name: "class", value: "vow-agent__head" }],
    [issueBadge(), specialistBadge(), phaseBadge()],
  );
}

/** The timestamp cell — HH:MM:SS in mono, muted (a quiet leading clock). */
function tsCell(): UiNode {
  return comp(
    "TableCell",
    [{ kind: "static", name: "class", value: "vow-agent-tool__ts" }],
    [{ expr: "time(tool.ts)", kind: "interp" }],
  );
}

/** The tool-name cell — a `<Badge>` coloured by the tool type (Edit/Write → accent, else neutral). */
function nameCell(): UiNode {
  return comp(
    "TableCell",
    [{ kind: "static", name: "class", value: "vow-agent-tool__name" }],
    [comp("Badge", [bound("label", "tool.name"), bound("tone", "toolTone(tool.name)")], [])],
  );
}

/** The summary cell — the free-text detail the tool event carried; fills the row's remaining width. */
function summaryCell(): UiNode {
  return comp(
    "TableCell",
    [{ kind: "static", name: "class", value: "vow-agent-tool__summary" }],
    [{ expr: "tool.summary", kind: "interp" }],
  );
}

/** One tool-call `<TableRow>` — timestamp · name badge · summary, keyed by `tool.ts`. */
function toolRow(): UiNode {
  const attrs: Attr[] = [];
  return {
    attrs,
    children: [tsCell(), nameCell(), summaryCell()],
    for: { as: "tool", each: "run.tools", key: "tool.ts" },
    kind: "component",
    name: "TableRow",
  };
}

/** The tool-feed `<Table>` — rendered only when the run has tool events. */
function toolTable(): UiNode {
  return comp("Table", [{ expr: "run.tools.length > 0", kind: "cond", type: "if" }], [toolRow()]);
}

/** The "waiting" paragraph shown when no `agent.tool` events have landed yet for this run. */
function waitingMessage(): UiNode {
  return {
    attrs: [
      { kind: "static", name: "class", value: "vow-agent__waiting" },
      { expr: "run.tools.length === 0", kind: "cond", type: "if" },
    ],
    children: [txt("Waiting for tool events…")],
    kind: "element",
    tag: "p",
  };
}

/** The tool-feed body — the table when tools exist, the waiting message otherwise. */
function agentBody(): UiNode {
  return comp(
    "CardBody",
    [],
    [classed("div", "vow-agent__tools", [toolTable(), waitingMessage()])],
  );
}

/** One agent `<Card>` — header (issue/specialist/phase) + body (tool feed). Looped over `runs`. */
function agentCard(): UiNode {
  return {
    attrs: [],
    children: [agentHeader(), agentBody()],
    for: { as: "run", each: "runs", key: "String(run.issue)" },
    kind: "component",
    name: "Card",
  };
}

/** The three empty-state messages the agents panel shows — mirroring the event-trace pattern. */
function agentsEmptyStates(): readonly UiNode[] {
  return emptyStates("runs.length", {
    empty: "No active agents.",
    failed: "Couldn’t load agents",
    loading: "Loading…",
  });
}

/** The outer `<section class="vow-agents">` — the active-run cards + the three status messages. */
function agentsPanel(): UiNode {
  return {
    attrs: [{ kind: "static", name: "class", value: "vow-agents" }],
    children: [agentCard(), ...agentsEmptyStates()],
    kind: "element",
    tag: "section",
  };
}

/**
 * The active-agents panel component — a fixed `<VowAgentPanel>` reading the live event feed
 * (`useEvents`) and deriving in-flight runs via `activeRunsFrom`. No baked data: events push in
 * via SSE and the 5s poll covers the fallback. Renders one `Card` per active issue, each showing
 * the issue number, the team specialist, the current phase, and a live `Table` of tool calls;
 * the cockpit binds to it via `loop: { as: agents }`.
 */
export function emitAgentPanelSfc(): string {
  const component: Component = {
    doc: ["Generated — the active-agents panel, derived live from /__vow/events. Do not edit."],
    imports: [
      { from: "vue", names: ["computed"] },
      { from: "@vow/store", names: ["activeRunsFrom", "useEvents"] },
      { default: "Badge", from: "./Badge.vue" },
      { default: "Card", from: "./Card.vue" },
      { default: "CardHeader", from: "./CardHeader.vue" },
      { default: "CardBody", from: "./CardBody.vue" },
      { default: "Table", from: "./Table.vue" },
      { default: "TableRow", from: "./TableRow.vue" },
      { default: "TableCell", from: "./TableCell.vue" },
    ],
    name: "VowAgentPanel",
    setup: AGENTS_SETUP,
    view: agentsPanel(),
  };
  return renderVueSfc(component);
}
