import type { Component, ImportDecl, UiNode } from "./types.ts";
import { bound, comp, txt } from "./helpers.ts";
import { emptyStates } from "./status-message.ts";
import { renderVueSfc } from "@vow/component";

/** A static-class element node with the given tag and children — the one-liner the plan SFCs build their
 *  rows + headings from (a `<div class="…">`, a `<span class="…">`, …). */
export function classed(tag: string, cls: string, children: readonly UiNode[]): UiNode {
  return {
    attrs: [{ kind: "static", name: "class", value: cls }],
    children: [...children],
    kind: "element",
    tag,
  };
}

/**
 * The shared pieces the three plan SFCs (`now-next`, `backlog`, `map`) compose — the `usePlan` setup line,
 * the status → Badge-tone map, the empty-state trio, the per-item row, and the `Component` → SFC build.
 * One source: the look + the data binding stay identical across the three layouts, so a plan row reads the
 * same wherever it sits.
 *
 * The plan is READ-ONLY — driven by the agent / MCP / loop, never the browser. So these SFCs carry NO
 * action buttons (no close/reopen, no start-work, no session link) unlike the live issue views; they
 * observe the local DAG (`usePlan`, the SQLite plan), they never narrate it.
 */

/** The setup line every plan SFC opens with — the local plan, its ready-queue, its blocked set, the state. */
export const PLAN_SETUP_LINE = `const { items, ready, blocked, state } = usePlan();`;

/**
 * The status → Badge-tone lines the plan SFCs share — a record lookup (not a chained ternary) keyed off the
 * plan status: `done` reads as proof (success/green), `doing` as the live accent (Vermilion intent),
 * `blocked` as a warning, `review` as info, and the rest neutral. One source — change the mapping here, all
 * three layouts follow. The SFCs run in the browser, so they inline it rather than import a node helper.
 */
export const PLAN_TONE_LINES = [
  `type PlanTone = "neutral" | "accent" | "success" | "warning" | "info";`,
  `const TONES: Record<string, PlanTone> = {`,
  `  blocked: "warning", doing: "accent", done: "success", review: "info",`,
  `};`,
  `const tone = (s: string): PlanTone => TONES[s] ?? "neutral";`,
];

/** The shared imports every plan SFC needs — `computed` (each layout derives its slices), `usePlan` (the
 *  live local plan), and `Badge` (the status / pillar chips). */
export const PLAN_IMPORTS: readonly ImportDecl[] = [
  { from: "vue", names: ["computed"] },
  { from: "@vow/store", names: ["usePlan"] },
  { default: "Badge", from: "./Badge.vue" },
];

/** The three empty-state messages every plan layout shares — only one shows, keyed off `state`/`items`.
 *  "Loading the plan…" while the first fetch is in flight, "Couldn't load the plan" when it failed, and the
 *  friendly "Nothing planned yet." when the local DAG is genuinely empty. */
export function planEmptyStates(): readonly UiNode[] {
  return emptyStates("items.length", {
    empty: "Nothing planned yet.",
    failed: "Couldn't load the plan",
    loading: "Loading the plan…",
  });
}

/** The `#{issue}` link cell — the bound GitHub issue number, shown only when the item carries one (a plan
 *  item may be issue-less). Muted + tabular, the same `vow-roadmap__num` chip the roadmap card uses. */
function issueRef(): UiNode {
  return {
    attrs: [
      { kind: "static", name: "class", value: "vow-roadmap__num" },
      { expr: "it.issue", kind: "cond", type: "if" },
    ],
    children: [txt("#"), { expr: "it.issue", kind: "interp" }],
    kind: "element",
    tag: "span",
  };
}

/** A pillar `<Badge>` — the item's throughline (`it.pillar`, a `pillar:` label), shown only when one is set.
 *  An outline chip so the pillar reads as a quiet tag beside the louder status badge. */
function pillarBadge(): UiNode {
  return comp(
    "Badge",
    [
      { expr: "it.pillar", kind: "cond", type: "if" },
      bound("label", "it.pillar"),
      { kind: "static", name: "variant", value: "outline" },
    ],
    [],
  );
}

/** A status `<Badge>` — `:label` + the shared `tone(...)` map (a soft badge, tone from the plan status). */
export function statusBadge(): UiNode {
  return comp("Badge", [bound("label", "it.status"), bound("tone", "tone(it.status)")], []);
}

/**
 * One plan-item row — the title leads (the content), then a meta footer carrying the `#issue` ref, an
 * optional status badge, and the pillar tag. Reuses the roadmap card's themed grid (`vow-roadmap__item`),
 * so a plan row reads exactly like a roadmap card. `each` is the source list (a section's items); `withStatus`
 * adds the status badge (the now/next rows derive their section from status, the backlog pool shows it).
 */
export function planRow(each: string, withStatus: boolean): UiNode {
  const meta: UiNode[] = [issueRef()];
  if (withStatus) {
    meta.push(statusBadge());
  }
  meta.push(pillarBadge());
  return {
    attrs: [{ kind: "static", name: "class", value: "vow-roadmap__item" }],
    children: [
      classed("span", "vow-roadmap__title", [{ expr: "it.title", kind: "interp" }]),
      classed("div", "vow-roadmap__meta", meta),
    ],
    for: { as: "it", each, key: "it.id" },
    kind: "element",
    tag: "li",
  };
}

/** One plan section — a `<section>` (a roadmap phase band) with a heading + a count, then its item grid (a
 *  `<ul>` of rows), shown only when the section has items. `heading` is the section title (Now / Next /
 *  Backlog), `each` the source list, `withStatus` whether each row shows its status badge. */
export function planSection(heading: string, each: string, withStatus: boolean): UiNode {
  return {
    attrs: [{ kind: "static", name: "class", value: "vow-roadmap__phase" }],
    children: [
      classed("header", "vow-roadmap__head", [
        classed("h3", "vow-roadmap__milestone", [txt(heading)]),
        classed("span", "vow-roadmap__due", [{ expr: `${each}.length`, kind: "interp" }]),
      ]),
      {
        attrs: [
          { kind: "static", name: "class", value: "vow-roadmap__items" },
          { expr: `${each}.length > 0`, kind: "cond", type: "if" },
        ],
        children: [planRow(each, withStatus)],
        kind: "element",
        tag: "ul",
      },
    ],
    kind: "element",
    tag: "section",
  };
}

/** Add the `items.length > 0` guard to a layout node so it renders only when the plan has items — its own
 *  `cond` attr alongside the layout's static class. */
function guardedLayout(layout: UiNode): UiNode {
  if (layout.kind !== "element") {
    return layout;
  }
  return {
    ...layout,
    attrs: [...layout.attrs, { expr: "items.length > 0", kind: "cond", type: "if" }],
  };
}

/** Wrap a plan layout's view tree in a `.vow-issues` `<section>` that shows the layout only when the plan
 *  has items, else one of the shared plan status messages — so the first screen is never a bare header. */
function planWrap(layout: UiNode): UiNode {
  return {
    attrs: [{ kind: "static", name: "class", value: "vow-issues" }],
    children: [guardedLayout(layout), ...planEmptyStates()],
    kind: "element",
    tag: "section",
  };
}

/** One plan SFC's spec — its component `name`, the generated-file `doc` banner, the `setup` script lines,
 *  and the `view` tree the wrapper guards. The single shape the three emitters pass to `planSfc`. */
export interface PlanSpec {
  readonly name: string;
  readonly doc: readonly string[];
  readonly setup: readonly string[];
  readonly view: UiNode;
}

/** Build a plan SFC `Component` from its spec — wraps the view in the shared `.vow-issues` section + the
 *  loading / failed / empty status trio, exactly like the issue layouts. */
export function planSfc(spec: PlanSpec): string {
  const component: Component = {
    doc: [...spec.doc],
    imports: [...PLAN_IMPORTS],
    name: spec.name,
    setup: [...spec.setup],
    view: planWrap(spec.view),
  };
  return renderVueSfc(component);
}
