import type { Component, UiNode } from "./types.ts";
import { emptyStates } from "./status-message.ts";
import { renderVueSfc } from "@vow/component";
import { txt } from "./helpers.ts";

/**
 * The live event-feed SFC (`useEvents`, tailable log) — the trace layout. It is a fixed component the
 * plugin materialises (`map-node.ts`'s `events:` node points at it). It reads `/__vow/events` live (no
 * baked data): `useEvents` subscribes to the SSE stream so each event PUSHES in instantly (true realtime),
 * with the 5s poll as the fallback. Renders the feed as a timestamped trace list — the surface the studio
 * trace panel, and any live dashboard, binds to via `events: { as: trace }` in a `.vow.md`.
 */

/** The setup line the event trace SFC opens with — the live feed and its fetch state. */
const EVENT_SETUP_LINE = `const { items, state } = useEvents();`;

/** The three empty-state messages the event trace shares — only one shows, keyed off `state`/`items`. */
function eventEmptyStates(): readonly UiNode[] {
  return emptyStates("items.length", {
    empty: "No events yet.",
    failed: "Couldn’t load events",
    loading: "Loading…",
  });
}

/** Add the `items.length > 0` guard to the trace list so it renders only when the feed has items. */
function guardedTrace(trace: UiNode): UiNode {
  if (trace.kind !== "element") {
    return trace;
  }
  return {
    ...trace,
    attrs: [...trace.attrs, { expr: "items.length > 0", kind: "cond", type: "if" }],
  };
}

/** Wrap the trace list in a `<section>` that shows it only when the feed has items, else one of the shared
 *  status messages — so the trace panel's first render is never a bare, empty section. */
function withEventEmptyStates(trace: UiNode): UiNode {
  return {
    attrs: [{ kind: "static", name: "class", value: "vow-events" }],
    children: [guardedTrace(trace), ...eventEmptyStates()],
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

/** An optional span — rendered only when `cond` is truthy; holds the given children. */
function optSpan(cls: string, cond: string, children: readonly UiNode[]): UiNode {
  return {
    attrs: [
      { kind: "static", name: "class", value: cls },
      { expr: cond, kind: "cond", type: "if" },
    ],
    children: [...children],
    kind: "element",
    tag: "span",
  };
}

/** One trace entry `<li>` — timestamp, kind, and the optional context fields (issue, phase, detail). */
function traceEntry(): UiNode {
  return {
    attrs: [{ kind: "static", name: "class", value: "vow-trace__entry" }],
    children: [
      classed("span", "vow-trace__ts", [{ expr: "it.ts", kind: "interp" }]),
      classed("span", "vow-trace__kind", [{ expr: "it.kind", kind: "interp" }]),
      optSpan("vow-trace__issue", "it.issue", [txt("#"), { expr: "it.issue", kind: "interp" }]),
      optSpan("vow-trace__phase", "it.phase", [{ expr: "it.phase", kind: "interp" }]),
      optSpan("vow-trace__detail", "it.detail", [{ expr: "it.detail", kind: "interp" }]),
    ],
    for: { as: "it", each: "items", key: "it.ts" },
    kind: "element",
    tag: "li",
  };
}

/** The trace list — a `<ul>` of event entries, one per item in the live feed. */
function traceList(): UiNode {
  return {
    attrs: [{ kind: "static", name: "class", value: "vow-trace" }],
    children: [traceEntry()],
    kind: "element",
    tag: "ul",
  };
}

/**
 * The event-trace component — a fixed `<VowEventTrace>` reading the live event feed (`useEvents`,
 * tailable log). No baked data: `useEvents` subscribes to the `/__vow/events` SSE stream (realtime push)
 * and polls as a fallback. Renders as a timestamped trace list; the studio trace panel and any live
 * dashboard bind to it via `events: { as: trace }`.
 */
export function emitEventTraceSfc(): string {
  const component: Component = {
    doc: [
      "Generated — the vow event feed as a trace list, read live from /__vow/events. Do not edit.",
    ],
    imports: [{ from: "@vow/store", names: ["useEvents"] }],
    name: "VowEventTrace",
    setup: [EVENT_SETUP_LINE],
    view: withEventEmptyStates(traceList()),
  };
  return renderVueSfc(component);
}
