import type { Component, UiNode } from "./types.ts";
import { bound, comp, el, txt } from "./helpers.ts";
import { emptyStates } from "./status-message.ts";
import { renderVueSfc } from "@vow/component";

/**
 * The generic live-data view SFCs — trace and list. Each is a fixed component the plugin materialises
 * (`map-node.ts`'s `events:` node points at one). They read `/__vow/events` live (no baked data, like the
 * issue plan) and render a feed of VowEvent objects. Each is a canonical `Component` rendered through
 * @vow/component — framework-neutral, never raw Vue.
 */

/**
 * The shared setup line every feed SFC opens with — the live events feed, its fetch state, and the actions.
 */
const FEED_SETUP_LINE = `const { items, state } = useFeed();`;

/** The shared empty-state messages every feed layout shares — only one shows, keyed off `state`/`items`.
 *  "Loading events…" while the first fetch is in flight, "Couldn't fetch events" when it failed, and the
 *  feed "Nothing recorded yet." when empty. */
function feedEmptyStates(): readonly UiNode[] {
  return emptyStates("items.length", {
    empty: "Nothing recorded yet.",
    failed: "Couldn't fetch events",
    loading: "Loading events…",
  });
}

/** Add the `items.length > 0` guard to a layout node so it renders only when the feed has items — its own
 *  `cond` attr, alongside the layout's static class. */
function guardedLayout(layout: UiNode): UiNode {
  if (layout.kind !== "element") {
    return layout;
  }
  return {
    ...layout,
    attrs: [...layout.attrs, { expr: "items.length > 0", kind: "cond", type: "if" }],
  };
}

/** Wrap a layout's view tree in a `<section>` that shows the layout only when the feed has items, else one
 *  of the shared status messages — so pages with empty feeds render gracefully. */
function withEmptyStates(layout: UiNode): UiNode {
  return {
    attrs: [{ kind: "static", name: "class", value: "vow-feed" }],
    children: [guardedLayout(layout), ...feedEmptyStates()],
    kind: "element",
    tag: "section",
  };
}

/** A static-class element node with the given tag and children. */
function classed(tag: string, cls: string, children: readonly UiNode[]): UiNode {
  return {
    attrs: [{ kind: "static", name: "class", value: cls }],
    children: [...children],
    kind: "element",
    tag,
  };
}

/** Trace the event kind to a readable label — a mapping of kind strings to human-friendly names. */
function traceKindLabel(): UiNode {
  return {
    attrs: [
      { kind: "static", name: "class", value: "vow-feed-trace__kind" },
      bound(
        "title",
        `{
          'run.started': 'Run started',
          'run.phase': 'Phase change',
          'run.finished': 'Run finished',
          'pr.merged': 'PR merged',
        }[ev.kind] || ev.kind`,
      ),
    ],
    children: [{ expr: `ev.kind.split('.')[1] || ev.kind`, kind: "interp" }],
    kind: "element",
    tag: "span",
  };
}

/** Format the ISO timestamp to a human-readable string. */
function traceTimestamp(): UiNode {
  return {
    attrs: [{ kind: "static", name: "class", value: "vow-feed-trace__ts" }],
    children: [
      {
        expr: `new Date(ev.ts).toLocaleTimeString()`,
        kind: "interp",
      },
    ],
    kind: "element",
    tag: "time",
  };
}

/** A single trace entry row — timestamp, kind, issue, PR, phase, detail. */
function traceRow(): UiNode {
  return {
    attrs: [{ kind: "static", name: "class", value: "vow-feed-trace__row" }],
    children: [
      traceTimestamp(),
      traceKindLabel(),
      classed("span", "vow-feed-trace__issue", [{ expr: `ev.issue || '—'`, kind: "interp" }]),
      classed("span", "vow-feed-trace__pr", [{ expr: `ev.pr || '—'`, kind: "interp" }]),
      classed("span", "vow-feed-trace__phase", [{ expr: `ev.phase || '—'`, kind: "interp" }]),
      classed("span", "vow-feed-trace__detail", [{ expr: `ev.detail || ''`, kind: "interp" }]),
    ],
    for: { as: "ev", each: "items", key: "ev.ts" },
    kind: "element",
    tag: "div",
  };
}

/**
 * The feed-trace component — a fixed `<VowFeedTrace>` reading the live event stream (`useFeed`,
 * `/__vow/events`). No baked data: it fetches and polls/streams. Renders a trace of observed operations
 * (run started/finished, PR merged, etc.) with timestamps, kinds, and optional context (issue, PR, phase).
 */
export function emitFeedTraceSfc(): string {
  const component: Component = {
    doc: ["Generated — the event stream as a trace, read live from /__vow/events. Do not edit."],
    imports: [{ from: "@vow/store", names: ["useFeed"] }],
    name: "VowFeedTrace",
    setup: [FEED_SETUP_LINE],
    view: withEmptyStates(classed("div", "vow-feed-trace", [traceRow()])),
  };
  return renderVueSfc(component);
}

/** A single feed list item — a line per event with the event's kind, timestamp, and detail. */
function listItem(): UiNode {
  return {
    attrs: [{ kind: "static", name: "class", value: "vow-feed-list__item" }],
    children: [
      {
        attrs: [{ kind: "static", name: "class", value: "vow-feed-list__time" }],
        children: [
          {
            expr: `new Date(ev.ts).toLocaleString()`,
            kind: "interp",
          },
        ],
        kind: "element",
        tag: "span",
      },
      {
        attrs: [{ kind: "static", name: "class", value: "vow-feed-list__kind" }],
        children: [{ expr: `ev.kind`, kind: "interp" }],
        kind: "element",
        tag: "span",
      },
      {
        attrs: [{ kind: "static", name: "class", value: "vow-feed-list__detail" }],
        children: [{ expr: `ev.detail || ''`, kind: "interp" }],
        kind: "element",
        tag: "span",
      },
    ],
    for: { as: "ev", each: "items", key: "ev.ts" },
    kind: "element",
    tag: "li",
  };
}

/**
 * The feed-list component — a fixed `<VowFeedList>` reading the live event stream. A simple list view
 * of events with timestamps, kinds, and details. Simpler than trace, good for inline dashboards.
 */
export function emitFeedListSfc(): string {
  const component: Component = {
    doc: ["Generated — the event stream as a list, read live from /__vow/events. Do not edit."],
    imports: [{ from: "@vow/store", names: ["useFeed"] }],
    name: "VowFeedList",
    setup: [FEED_SETUP_LINE],
    view: withEmptyStates(classed("ul", "vow-feed-list", [listItem()])),
  };
  return renderVueSfc(component);
}
