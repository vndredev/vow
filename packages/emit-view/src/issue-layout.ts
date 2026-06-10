import { asObject, str } from "./helpers.ts";

/**
 * The issue-plan layouts (`issues: { as }`) → the component the plugin materialises for each. The ONE
 * source `mapNode` (what to render) and `issueLayouts` (what to materialise) share, so a layout can never
 * render a component the plugin didn't write.
 */
export const ISSUE_LAYOUTS = {
  board: "VowIssueBoard",
  roadmap: "VowIssueRoadmap",
  table: "VowIssueTable",
} as const;

export type IssueLayout = keyof typeof ISSUE_LAYOUTS;

/** A type guard: `name` is one of the known issue layouts. */
function isIssueLayout(name: string): name is IssueLayout {
  return Object.hasOwn(ISSUE_LAYOUTS, name);
}

/**
 * Resolve + validate an `issues: { as }` value (defaults to `table`); throws on an unknown layout, so a
 * typo is a clear build error rather than a dangling import to a never-materialised component.
 */
export function issueLayout(value: unknown): IssueLayout {
  const as = str(asObject(value)["as"]) || "table";
  if (!isIssueLayout(as)) {
    throw new Error(
      `vow: unknown issues layout "${as}" — use ${Object.keys(ISSUE_LAYOUTS).join(", ")}`,
    );
  }
  return as;
}
