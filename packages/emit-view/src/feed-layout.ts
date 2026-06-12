import { asRecord } from "@vow/core";
import { str } from "./helpers.ts";

/**
 * The feed/live-data view layouts (`events: { as }`) → the component the plugin materialises for each. The ONE
 * source `mapNode` (what to render) and `feedLayouts` (what to materialise) share, so a layout can never
 * render a component the plugin didn't write.
 */
export const FEED_LAYOUTS = {
  trace: "VowFeedTrace",
  list: "VowFeedList",
} as const;

export type FeedLayout = keyof typeof FEED_LAYOUTS;

/** A type guard: `name` is one of the known feed layouts. */
function isFeedLayout(name: string): name is FeedLayout {
  return Object.hasOwn(FEED_LAYOUTS, name);
}

/**
 * Resolve + validate an `events: { as }` value (defaults to `trace`); throws on an unknown layout, so a
 * typo is a clear build error rather than a dangling import to a never-materialised component.
 */
export function feedLayout(value: unknown): FeedLayout {
  const as = str(asRecord(value)["as"]) || "trace";
  if (!isFeedLayout(as)) {
    throw new Error(
      `emit-view: unknown feed layout "${as}" — use ${Object.keys(FEED_LAYOUTS).join(", ")}`,
    );
  }
  return as;
}
