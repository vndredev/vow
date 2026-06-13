import type { Attr, Component, UiNode } from "./types.ts";
import { bound, comp } from "./helpers.ts";
import { errorMessage, statusMessage } from "./status-message.ts";
import { renderVueSfc } from "@vow/component";

/**
 * The live agent-loop-status SFC (`useAgentLoopStatus`) — the `status` layout. It is a fixed component the
 * plugin materialises (`map-node.ts`'s `loop:` node points at it). It reads `/__vow/agent-loop/status` live
 * (no baked data): `useAgentLoopStatus` polls the status the loop process records to the repo-root
 * `.vow/loop-status.json`, so the studio sees whether autonomy is on, the current round, and the round's
 * effective backlog + open PRs. The surface the cockpit binds to via `loop: { as: status }` in a `.vow.md`.
 *
 * It composes vow PRIMITIVES — a `Badge` for the run state (tone by `running`) and the `Stats`/`Stat`
 * stat-card grid for the round's metrics — so it inherits the design language (the `.vow-badge`/`.vow-stat`
 * theme parts) exactly like the Board/Table views, never bespoke classed `<div>`s whose CSS doesn't exist.
 *
 * Read-only: the status is produced by the loop, never the browser. The start/stop CONTROL half is a gated
 * follow-up (#623, needs a cross-process stop signal) — this element observes, it never narrates.
 */

/** The setup line the loop-status SFC opens with — the live status object and its fetch state. */
const LOOP_SETUP_LINE = `const { status, state } = useAgentLoopStatus();`;

/** A static-class element node with the given tag and children. */
function classed(tag: string, cls: string, children: readonly UiNode[]): UiNode {
  return {
    attrs: [{ kind: "static", name: "class", value: cls }],
    children: [...children],
    kind: "element",
    tag,
  };
}

/** One mutually-exclusive run-state `<Badge>` — `running` → "Autonomy on" (success), the `!running` branch
 *  → "Autonomy idle" (neutral); the soft variant the rest of the studio uses. So the header reads one
 *  truth at a time, as real Badges the theme styles, not classless pills. */
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

/** The run-state header — the running Badge XOR the idle Badge, so the header always reads one truth. */
function header(): UiNode {
  return classed("header", "vow-loop__head", [
    stateBadge("status.running", "success", "Autonomy on"),
    stateBadge("!status.running", "neutral", "Autonomy idle"),
  ]);
}

/** One stat-card `<Stat>` — its `:value` bound to `status.<field>`, its `:label` the metric name. The
 *  `.vow-stat` part already renders a bordered, padded, radiused tile with a large value + muted label;
 *  the `.vow-loop` theme lifts the label above the value and uppercases it for the cockpit's stat row. */
function metricStat(label: string, field: string): UiNode {
  return comp(
    "Stat",
    [bound("value", `status.${field}`), { kind: "static", name: "label", value: label }],
    [],
  );
}

/** The optional last-round `<Stat>` — rendered only when the loop has advanced at least once. A `v-if` on
 *  the component node, so an idle loop's stat row stays the three live counts. */
function lastRoundStat(): UiNode {
  const attrs: Attr[] = [
    { expr: "status.lastRound", kind: "cond", type: "if" },
    bound("value", "status.lastRound"),
    { kind: "static", name: "label", value: "Last round" },
  ];
  return comp("Stat", attrs, []);
}

/** The metric grid — a `<Stats>` of stat cards (round, backlog, open PRs, and the optional last-round). The
 *  `Stats` primitive is the responsive auto-fit grid the theme styles; each `Stat` is a real card, so the
 *  counts read as a spaced stat row, never the jammed "Round0" run the classless version produced. */
function metrics(): UiNode {
  return comp(
    "Stats",
    [],
    [
      metricStat("Round", "round"),
      metricStat("Backlog", "backlog"),
      metricStat("Open PRs", "openPrs"),
      lastRoundStat(),
    ],
  );
}

/** The two fetch-state messages the loop status shows in place of content — only one renders, keyed off
 *  `state`. A single status object has no "empty" state (the idle default IS the well-formed zero), so this
 *  is the loading + failed pair, not the empty-collection trio the entity views use. */
function loopEmptyStates(): readonly UiNode[] {
  return [
    statusMessage("state.loading && !state.error", "Loading…"),
    errorMessage("state.error", "Couldn’t load the loop status"),
  ];
}

/** The loop-status panel — the run-state header + metric grid, shown once the first fetch settles cleanly,
 *  with the loading / failed messages in its place until then. */
function loopPanel(): UiNode {
  return classed("section", "vow-loop", [
    {
      attrs: [
        { kind: "static", name: "class", value: "vow-loop__body" },
        { expr: "!state.loading && !state.error", kind: "cond", type: "if" },
      ],
      children: [header(), metrics()],
      kind: "element",
      tag: "div",
    },
    ...loopEmptyStates(),
  ]);
}

/**
 * The agent-loop-status component — a fixed `<VowAgentLoopStatus>` reading the live loop status
 * (`useAgentLoopStatus`, the repo-root status file). No baked data: it polls `/__vow/agent-loop/status`.
 * Renders the run state (on / idle) as a `<Badge>` and the round's round / backlog / open-PR metrics as a
 * `<Stats>` stat-card grid; the cockpit and any autonomy dashboard bind to it via `loop: { as: status }`.
 */
export function emitAgentLoopStatusSfc(): string {
  const component: Component = {
    doc: [
      "Generated — the vow agent-loop status, read live from /__vow/agent-loop/status. Do not edit.",
    ],
    imports: [
      { from: "@vow/store", names: ["useAgentLoopStatus"] },
      { default: "Badge", from: "./Badge.vue" },
      { default: "Stats", from: "./Stats.vue" },
      { default: "Stat", from: "./Stat.vue" },
    ],
    name: "VowAgentLoopStatus",
    setup: [LOOP_SETUP_LINE],
    view: loopPanel(),
  };
  return renderVueSfc(component);
}
