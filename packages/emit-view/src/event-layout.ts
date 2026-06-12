import { asRecord } from "@vow/core";
import { str } from "./helpers.ts";

/**
 * The event-feed layouts (`events: { as }`) → the component the plugin materialises for each. The ONE
 * source `mapNode` (what to render) and `eventLayouts` (what to materialise) share, so a layout can never
 * render a component the plugin didn't write.
 */
export const EVENT_LAYOUTS = {
  trace: "VowEventTrace",
} as const;

export type EventLayout = keyof typeof EVENT_LAYOUTS;

/** A type guard: `name` is one of the known event layouts. */
function isEventLayout(name: string): name is EventLayout {
  return Object.hasOwn(EVENT_LAYOUTS, name);
}

/**
 * Resolve + validate an `events: { as }` value (defaults to `trace`); throws on an unknown layout, so a
 * typo is a clear build error rather than a dangling import to a never-materialised component.
 */
export function eventLayout(value: unknown): EventLayout {
  const as = str(asRecord(value)["as"]) || "trace";
  if (!isEventLayout(as)) {
    throw new Error(
      `emit-view: unknown events layout "${as}" — use ${Object.keys(EVENT_LAYOUTS).join(", ")}`,
    );
  }
  return as;
}
