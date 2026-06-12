import type { Component, UiNode } from "./types.ts";
import { bound, comp, txt } from "./helpers.ts";
import { emptyStates } from "./status-message.ts";
import { renderVueSfc } from "@vow/component";

/**
 * The live event-feed SFC (`useEvents`, read from `/__vow/events`) — a fixed `<VowEventTrace>` the plugin
 * materialises when a `## view` contains an `events: { as: trace }` node. Reads the shared reactive event
 * feed, renders newest-first (a `computed` reverse), and shows a loading / error / empty status trio.
 */

/** The setup lines the event trace SFC uses — the live feed, its fetch state, and the sorted list. */
const EVENT_SETUP_LINES = [
  `const { items, state } = useEvents();`,
  `const sorted = computed(() => [...items].reverse());`,
];

/** The three empty-state messages the event trace layout shares — only one shows at a time. */
function eventEmptyStates(): readonly UiNode[] {
  return emptyStates("sorted.length", {
    empty: "No events yet.",
    failed: "Couldn't load events.",
    loading: "Connecting…",
  });
}

/** A kind `<Badge>` chip — `:label` bound to the event's `kind` string. */
function kindBadge(): UiNode {
  return comp("Badge", [bound("label", "ev.kind")], []);
}

/** A timestamp span — the ISO string, shown as-is. */
function tsSpan(): UiNode {
  return {
    attrs: [{ kind: "static", name: "class", value: "vow-trace__ts" }],
    children: [{ expr: "ev.ts", kind: "interp" }],
    kind: "element",
    tag: "span",
  };
}

/** The optional `#<issue>` chip — shown only when the event carries an issue number. */
function issueChip(): UiNode {
  return {
    attrs: [
      { kind: "static", name: "class", value: "vow-trace__issue" },
      { expr: "ev.issue", kind: "cond", type: "if" },
    ],
    children: [txt("#"), { expr: "ev.issue", kind: "interp" }],
    kind: "element",
    tag: "span",
  };
}

/** The optional `PR #<pr>` chip — shown only when the event carries a PR number. */
function prChip(): UiNode {
  return {
    attrs: [
      { kind: "static", name: "class", value: "vow-trace__pr" },
      { expr: "ev.pr", kind: "cond", type: "if" },
    ],
    children: [txt("PR #"), { expr: "ev.pr", kind: "interp" }],
    kind: "element",
    tag: "span",
  };
}

/** The optional phase span — shown only when the event carries a phase string. */
function phaseSpan(): UiNode {
  return {
    attrs: [
      { kind: "static", name: "class", value: "vow-trace__phase" },
      { expr: "ev.phase", kind: "cond", type: "if" },
    ],
    children: [{ expr: "ev.phase", kind: "interp" }],
    kind: "element",
    tag: "span",
  };
}

/** The optional detail span — shown only when the event carries a detail string. */
function detailSpan(): UiNode {
  return {
    attrs: [
      { kind: "static", name: "class", value: "vow-trace__detail" },
      { expr: "ev.detail", kind: "cond", type: "if" },
    ],
    children: [{ expr: "ev.detail", kind: "interp" }],
    kind: "element",
    tag: "span",
  };
}

/** One event row in the trace feed — ts, kind Badge, optional issue/pr/phase/detail. */
function eventRow(): UiNode {
  return {
    attrs: [{ kind: "static", name: "class", value: "vow-trace__row" }],
    children: [tsSpan(), kindBadge(), issueChip(), prChip(), phaseSpan(), detailSpan()],
    for: { as: "ev", each: "sorted", key: "ev.ts" },
    kind: "element",
    tag: "li",
  };
}

/** The trace feed layout — a `<ul>` of event rows, shown only when the sorted list has items. */
function traceLayout(): UiNode {
  return {
    attrs: [
      { kind: "static", name: "class", value: "vow-trace" },
      { expr: "sorted.length > 0", kind: "cond", type: "if" },
    ],
    children: [eventRow()],
    kind: "element",
    tag: "ul",
  };
}

/** Wrap the trace layout + status messages in a `<section>`. */
function withEmptyStates(layout: UiNode): UiNode {
  return {
    attrs: [{ kind: "static", name: "class", value: "vow-events" }],
    children: [layout, ...eventEmptyStates()],
    kind: "element",
    tag: "section",
  };
}

/**
 * The event-trace component — a fixed `<VowEventTrace>` reading the live event feed (`useEvents`,
 * from `/__vow/events`). Renders newest-first via a `computed` reverse. Shows loading / error / empty
 * status messages, and the trace list only when events have arrived.
 */
export function emitEventTraceSfc(): string {
  const component: Component = {
    doc: ["Generated — the live event feed as a trace, read from /__vow/events. Do not edit."],
    imports: [
      { from: "vue", names: ["computed"] },
      { from: "@vow/store", names: ["useEvents"] },
      { default: "Badge", from: "./Badge.vue" },
    ],
    name: "VowEventTrace",
    setup: EVENT_SETUP_LINES,
    view: withEmptyStates(traceLayout()),
  };
  return renderVueSfc(component);
}
