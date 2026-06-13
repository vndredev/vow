import type { Component, UiNode } from "./types.ts";
import { errorMessage, statusMessage } from "./status-message.ts";
import { renderVueSfc } from "@vow/component";
import { txt } from "./helpers.ts";

/**
 * The live agent-loop-status SFC (`useAgentLoopStatus`) — the `status` layout. It is a fixed component the
 * plugin materialises (`map-node.ts`'s `loop:` node points at it). It reads `/__vow/agent-loop/status` live
 * (no baked data): `useAgentLoopStatus` polls the status the loop process records to the repo-root
 * `.vow/loop-status.json`, so the studio sees whether autonomy is on, the current round, and the round's
 * effective backlog + open PRs. The surface the cockpit binds to via `loop: { as: status }` in a `.vow.md`.
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

/** A `v-if`-guarded `<span>` carrying a static class and literal text — one of the mutually-exclusive
 *  run-state pills (running / idle), so the surface reads one truth at a time. */
function statePill(cls: string, cond: string, label: string): UiNode {
  return {
    attrs: [
      { kind: "static", name: "class", value: cls },
      { expr: cond, kind: "cond", type: "if" },
    ],
    children: [txt(label)],
    kind: "element",
    tag: "span",
  };
}

/** One labelled metric — a `<div>` of a static label and the interpolated `status.<field>` value, so the
 *  round / backlog / open-PR counts read as a stat grid, not a bare number. */
function metric(label: string, field: string): UiNode {
  return classed("div", "vow-loop__metric", [
    classed("span", "vow-loop__label", [txt(label)]),
    classed("span", "vow-loop__value", [{ expr: `status.${field}`, kind: "interp" }]),
  ]);
}

/** The optional last-round timestamp — rendered only when the loop has advanced at least once. */
function lastRound(): UiNode {
  return {
    attrs: [
      { kind: "static", name: "class", value: "vow-loop__last" },
      { expr: "status.lastRound", kind: "cond", type: "if" },
    ],
    children: [
      classed("span", "vow-loop__label", [txt("Last round")]),
      classed("span", "vow-loop__value", [{ expr: "status.lastRound", kind: "interp" }]),
    ],
    kind: "element",
    tag: "div",
  };
}

/** The run-state header — the running pill XOR the idle pill, so the header always reads one truth. */
function header(): UiNode {
  return classed("header", "vow-loop__head", [
    statePill("vow-loop__pill vow-loop__pill--on", "status.running", "Autonomy on"),
    statePill("vow-loop__pill vow-loop__pill--off", "!status.running", "Autonomy idle"),
  ]);
}

/** The metric grid — round, backlog, open PRs, and the optional last-round timestamp. */
function metrics(): UiNode {
  return classed("div", "vow-loop__metrics", [
    metric("Round", "round"),
    metric("Backlog", "backlog"),
    metric("Open PRs", "openPrs"),
    lastRound(),
  ]);
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
 * Renders the run state (on / idle) and the round's round / backlog / open-PR metrics; the cockpit and any
 * autonomy dashboard bind to it via `loop: { as: status }`.
 */
export function emitAgentLoopStatusSfc(): string {
  const component: Component = {
    doc: [
      "Generated — the vow agent-loop status, read live from /__vow/agent-loop/status. Do not edit.",
    ],
    imports: [{ from: "@vow/store", names: ["useAgentLoopStatus"] }],
    name: "VowAgentLoopStatus",
    setup: [LOOP_SETUP_LINE],
    view: loopPanel(),
  };
  return renderVueSfc(component);
}
