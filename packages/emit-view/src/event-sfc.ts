import type { Attr, Component, UiNode } from "./types.ts";
import { bound, comp, txt } from "./helpers.ts";
import { emptyStates } from "./status-message.ts";
import { renderVueSfc } from "@vow/component";

/**
 * The live event-feed SFC (`useEvents`, tailable log) — the trace layout. It is a fixed component the
 * plugin materialises (`map-node.ts`'s `events:` node points at it). It reads `/__vow/events` live (no
 * baked data): `useEvents` subscribes to the SSE stream so each event PUSHES in instantly (true realtime),
 * with the 5s poll as the fallback. Renders the feed as a STRUCTURED trace — a `Table` of aligned columns
 * (formatted time · a kind `Badge` · the #issue · the phase/detail), newest-first, scrolling on overflow —
 * so it inherits the design language (`.vow-table`/`.vow-badge`) exactly like the issue Table, never a raw
 * ISO-string run. The surface the studio cockpit, and any live dashboard, binds to via `events: { as: trace }`.
 */

/** The setup the event trace SFC opens with — the live feed + state, the newest-first ordering, and the
 *  two framework-neutral helpers the rows evaluate: a kind → tone lookup and a `ts` → HH:MM:SS formatter. */
const EVENT_SETUP: readonly string[] = [
  `const { items, state } = useEvents();`,
  // The feed is appended oldest-first; the trace reads newest-first (the latest run at the top).
  `const feed = computed(() => [...items].reverse());`,
  // The HH:MM:SS of an ISO `ts` — the operator reads a clock, never the raw "2026-06-12T20:03:55.497Z".
  `function time(ts: string): string {`,
  `  return new Date(ts).toTimeString().slice(0, 8);`,
  `}`,
  // The kind → Badge tone lookup, evaluated per row. Started/publish are in-flight (accent).
  // Done/merged/finished are proof (success). A failed run is danger. Everything else (a phase) is neutral.
  `type Tone = "neutral" | "accent" | "success" | "danger";`,
  `function tone(kind: string): Tone {`,
  `  if (kind.includes("failed")) return "danger";`,
  `  if (kind.includes("done") || kind.includes("merged") || kind.includes("finished")) return "success";`,
  `  if (kind.includes("started") || kind.includes("publish")) return "accent";`,
  `  return "neutral";`,
  `}`,
];

/** The three empty-state messages the event trace shares — only one shows, keyed off `state`/`items`. */
function eventEmptyStates(): readonly UiNode[] {
  return emptyStates("items.length", {
    empty: "No events yet.",
    failed: "Couldn’t load events",
    loading: "Loading…",
  });
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

/** A `<TableCell>` carrying a static class + children — the aligned column the theme styles. */
function cell(cls: string, children: readonly UiNode[]): UiNode {
  return comp("TableCell", [{ kind: "static", name: "class", value: cls }], [...children]);
}

/** The time cell — the event's `ts` formatted to HH:MM:SS, monospace + muted (a quiet leading clock). */
function timeCell(): UiNode {
  return cell("vow-trace__ts", [{ expr: "time(it.ts)", kind: "interp" }]);
}

/** The kind cell — a `<Badge>` coloured by the kind's `tone(...)`, so a run's started/done/failed reads at
 *  a glance (accent in-flight, success on proof, danger on failure, neutral for a phase). */
function kindCell(): UiNode {
  return cell("vow-trace__kind", [
    comp("Badge", [bound("label", "it.kind"), bound("tone", "tone(it.kind)")], []),
  ]);
}

/** The issue cell — `#<issue>` in mono, present only when the event names an issue. */
function issueCell(): UiNode {
  return cell("vow-trace__issue", [
    {
      attrs: [{ expr: "it.issue", kind: "cond", type: "if" }],
      children: [txt("#"), { expr: "it.issue", kind: "interp" }],
      kind: "element",
      tag: "span",
    },
  ]);
}

/** The detail cell — the phase then the free-text detail, each present only when the event carries it, so
 *  a phase event reads its phase and a verdict reads its detail; a bare event leaves the column empty. */
function detailCell(): UiNode {
  return cell("vow-trace__detail", [
    {
      attrs: [
        { kind: "static", name: "class", value: "vow-trace__phase" },
        { expr: "it.phase", kind: "cond", type: "if" },
      ],
      children: [{ expr: "it.phase", kind: "interp" }],
      kind: "element",
      tag: "span",
    },
    {
      attrs: [
        { kind: "static", name: "class", value: "vow-trace__detail-text" },
        { expr: "it.detail", kind: "cond", type: "if" },
      ],
      children: [{ expr: "it.detail", kind: "interp" }],
      kind: "element",
      tag: "span",
    },
  ]);
}

/** One trace row `<TableRow>` — the aligned time · kind · issue · detail columns, one per feed item. */
function traceRow(): UiNode {
  const attrs: Attr[] = [];
  const node: UiNode = {
    attrs,
    children: [timeCell(), kindCell(), issueCell(), detailCell()],
    for: { as: "it", each: "feed", key: "it.ts" },
    kind: "component",
    name: "TableRow",
  };
  return node;
}

/** The trace table — a `<Table>` whose body rows are the feed events, newest-first; the `.vow-trace` wrapper
 *  caps the height + scrolls on overflow, so a long run stays a contained, scannable column. */
function traceTable(): UiNode {
  return classed("div", "vow-trace", [comp("Table", [], [traceRow()])]);
}

/** Add the `items.length > 0` guard to the trace so it renders only when the feed has items. */
function guardedTrace(trace: UiNode): UiNode {
  if (trace.kind !== "element") {
    return trace;
  }
  return {
    ...trace,
    attrs: [...trace.attrs, { expr: "items.length > 0", kind: "cond", type: "if" }],
  };
}

/** Wrap the trace in a `<section>` that shows it only when the feed has items, else one of the shared
 *  status messages — so the trace panel's first render is never a bare, empty section. */
function withEventEmptyStates(trace: UiNode): UiNode {
  return {
    attrs: [{ kind: "static", name: "class", value: "vow-events" }],
    children: [guardedTrace(trace), ...eventEmptyStates()],
    kind: "element",
    tag: "section",
  };
}

/**
 * The event-trace component — a fixed `<VowEventTrace>` reading the live event feed (`useEvents`,
 * tailable log). No baked data: `useEvents` subscribes to the `/__vow/events` SSE stream (realtime push)
 * and polls as a fallback. Renders as a structured `Table` of aligned columns (formatted time · a kind
 * `Badge` · #issue · phase/detail), newest-first; the studio cockpit and any live dashboard bind to it via
 * `events: { as: trace }`.
 */
export function emitEventTraceSfc(): string {
  const component: Component = {
    doc: [
      "Generated — the vow event feed as a structured trace, read live from /__vow/events. Do not edit.",
    ],
    imports: [
      { from: "vue", names: ["computed"] },
      { from: "@vow/store", names: ["useEvents"] },
      { default: "Badge", from: "./Badge.vue" },
      { default: "Table", from: "./Table.vue" },
      { default: "TableRow", from: "./TableRow.vue" },
      { default: "TableCell", from: "./TableCell.vue" },
    ],
    name: "VowEventTrace",
    setup: EVENT_SETUP,
    view: withEventEmptyStates(traceTable()),
  };
  return renderVueSfc(component);
}
