import type { Component, UiNode } from "./types.ts";
import {
  ISSUE_SETUP_LINE,
  ISSUE_VARIANT_LINES,
  classed,
  roadmapOpen,
  roadmapShipped,
  withEmptyStates,
} from "./issue-sfc.ts";
import { NORTH_STAR } from "@vow/observability";
import { renderVueSfc } from "@vow/component";
import { txt } from "./helpers.ts";

/**
 * The issue-compass SFC — the live issue plan grouped by north-star PILLAR (the throughline) instead of
 * milestone. The orthogonal partner to the roadmap: where the roadmap reads by date (a milestone is WHEN),
 * the compass reads by capability (a pillar is WHAT, toward its horizon). It reuses the roadmap's item
 * rendering (`roadmapOpen`/`roadmapShipped`) — only the grouping + the per-pillar head are compass-specific.
 */

/** The pillar metadata baked into the compass SFC — label (for matching an issue's labels), title, and
    horizon, in NORTH_STAR order. The single source (`@vow/observability`) the generated view groups by. */
function pillarMeta(): readonly { horizon: string; label: string; title: string }[] {
  return NORTH_STAR.map((pillar) => ({
    horizon: pillar.horizon,
    label: pillar.label,
    title: pillar.title,
  }));
}

const COMPASS_SCRIPT = [
  ISSUE_SETUP_LINE,
  ...ISSUE_VARIANT_LINES,
  `interface Group { title: string; horizon: string; open: IssueItem[]; done: IssueItem[] }`,
  `const pillars = ${JSON.stringify(pillarMeta())} as const;`,
  `const groups = computed<Group[]>(() =>`,
  `  pillars.map((p) => ({`,
  `    title: p.title,`,
  `    horizon: p.horizon,`,
  `    open: items.filter((it) => it.status !== "done" && it.issue.labels.includes(p.label)),`,
  `    done: items.filter((it) => it.status === "done" && it.issue.labels.includes(p.label)),`,
  `  })),`,
  `);`,
];

/** One pillar `<section>` — its title + horizon, then the open cards (reused from the roadmap), then the
 *  collapsed shipped work (the "how far along"). Grouped by pillar, in NORTH_STAR order. */
function compassPillar(): UiNode {
  return {
    attrs: [{ kind: "static", name: "class", value: "vow-compass__pillar" }],
    children: [
      {
        attrs: [{ kind: "static", name: "class", value: "vow-compass__head" }],
        children: [
          {
            attrs: [{ kind: "static", name: "class", value: "vow-compass__heading" }],
            children: [
              classed("h3", "vow-compass__title", [{ expr: "p.title", kind: "interp" }]),
              classed("span", "vow-compass__count", [
                { expr: "p.open.length", kind: "interp" },
                txt(" open"),
              ]),
            ],
            kind: "element",
            tag: "div",
          },
          classed("p", "vow-compass__horizon", [{ expr: "p.horizon", kind: "interp" }]),
        ],
        kind: "element",
        tag: "header",
      },
      roadmapOpen(),
      roadmapShipped(),
    ],
    for: { as: "p", each: "groups", key: "p.title" },
    kind: "element",
    tag: "section",
  };
}

/** The compass view tree — a `<section>` per north-star pillar, in NORTH_STAR order (not by date). */
function compassView(): UiNode {
  return {
    attrs: [{ kind: "static", name: "class", value: "vow-compass" }],
    children: [compassPillar()],
    kind: "element",
    tag: "div",
  };
}

/**
 * The issue-compass component — a fixed `<VowIssueCompass>` reading the live issue plan (`useIssues`,
 * gh-direct), grouped by **pillar** (the north-star throughline) instead of milestone. The forward lens:
 * what each enduring capability has open, toward its horizon.
 */
export function emitIssueCompassSfc(): string {
  const component: Component = {
    doc: [
      "Generated — the issue plan as a compass: open work per north-star pillar (the throughline). Do not edit.",
    ],
    imports: [
      { from: "vue", names: ["computed"] },
      { from: "@vow/store", names: ["type IssueItem", "useIssues"] },
      { default: "Badge", from: "./Badge.vue" },
      { default: "Button", from: "./Button.vue" },
    ],
    name: "VowIssueCompass",
    setup: COMPASS_SCRIPT,
    view: withEmptyStates(compassView()),
  };
  return renderVueSfc(component);
}
