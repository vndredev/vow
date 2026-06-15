import { asRecord } from "@vow/core";
import { str } from "./helpers.ts";

/**
 * The local-plan layouts (`plan: { as }`) → the component the plugin materialises for each. The ONE source
 * `mapNode` (what to render) and `planLayouts` (what to materialise) share, so a layout can never render a
 * component the plugin didn't write. The read-only sibling of `issues:` — where the issue layouts read the
 * live GitHub plan, these read the local SQLite DAG (`usePlan`, the agent-driven plan vow develops by).
 */
export const PLAN_LAYOUTS = {
  backlog: "VowPlanBacklog",
  map: "VowPlanMap",
  "now-next": "VowPlanNowNext",
} as const;

export type PlanLayout = keyof typeof PLAN_LAYOUTS;

/** A type guard: `name` is one of the known plan layouts. */
function isPlanLayout(name: string): name is PlanLayout {
  return Object.hasOwn(PLAN_LAYOUTS, name);
}

/**
 * Resolve + validate a `plan: { as }` value (defaults to `now-next`, the work-to-do-next lens); throws on
 * an unknown layout, so a typo is a clear build error rather than a dangling import to a never-materialised
 * component.
 */
export function planLayout(value: unknown): PlanLayout {
  const as = str(asRecord(value)["as"]) || "now-next";
  if (!isPlanLayout(as)) {
    throw new Error(
      `emit-view: unknown plan layout "${as}" — use ${Object.keys(PLAN_LAYOUTS).join(", ")}`,
    );
  }
  return as;
}
