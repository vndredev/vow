import { asRecord } from "@vow/core";
import { str } from "./helpers.ts";

/**
 * The agent-loop layouts (`loop: { as }`) → the component the plugin materialises for each. The ONE
 * source `mapNode` (what to render) and `loopLayouts` (what to materialise) share, so a layout can never
 * render a component the plugin didn't write. One layout today (`status`) — the loop made observable.
 */
export const LOOP_LAYOUTS = {
  status: "VowAgentLoopStatus",
} as const;

export type LoopLayout = keyof typeof LOOP_LAYOUTS;

/** A type guard: `name` is one of the known agent-loop layouts. */
function isLoopLayout(name: string): name is LoopLayout {
  return Object.hasOwn(LOOP_LAYOUTS, name);
}

/**
 * Resolve + validate a `loop: { as }` value (defaults to `status`); throws on an unknown layout, so a
 * typo is a clear build error rather than a dangling import to a never-materialised component.
 */
export function loopLayout(value: unknown): LoopLayout {
  const as = str(asRecord(value)["as"]) || "status";
  if (!isLoopLayout(as)) {
    throw new Error(
      `emit-view: unknown loop layout "${as}" — use ${Object.keys(LOOP_LAYOUTS).join(", ")}`,
    );
  }
  return as;
}
