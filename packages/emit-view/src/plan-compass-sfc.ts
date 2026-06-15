import { PLAN_SETUP_LINE, PLAN_TONE_LINES, classed, planRow, planSfc } from "./plan-shared.ts";
import { scriptJson, txt } from "./helpers.ts";
import { NORTH_STAR } from "@vow/observability";
import type { UiNode } from "./types.ts";

/**
 * The third local-plan SFC — `map`, the compass-local: the live local plan (`usePlan`, the SQLite DAG)
 * grouped by north-star PILLAR (the throughline) instead of by status. The orthogonal partner to now-next:
 * where now/next reads by lifecycle (what is happening, what is up next), the map reads by capability (a
 * pillar is WHAT, toward its horizon). The local mirror of the issue compass — but the pillar comes straight
 * off the plan item (`it.pillar`, a `pillar:` label), not resolved from issue labels.
 *
 * READ-ONLY (the plan is agent-driven) and framework-neutral (a canonical `Component`); it reuses the
 * compass head (`.vow-compass__*`) + the roadmap card grid (`.vow-roadmap__*`), so it reads like the issue
 * compass.
 */

/** The pillar metadata baked into the map SFC — `label` (matched against `it.pillar`), title, and horizon,
    in NORTH_STAR order. The single source (`@vow/observability`) the generated view groups by. */
function pillarMeta(): readonly { horizon: string; label: string; title: string }[] {
  return NORTH_STAR.map((pillar) => ({
    horizon: pillar.horizon,
    label: pillar.label,
    title: pillar.title,
  }));
}

const MAP_SCRIPT = [
  PLAN_SETUP_LINE,
  ...PLAN_TONE_LINES,
  `const pillars = ${scriptJson(pillarMeta())} as const;`,
  `const groups = computed(() =>`,
  `  pillars.map((p) => ({`,
  `    title: p.title,`,
  `    horizon: p.horizon,`,
  `    open: items.filter((it) => it.status !== "done" && it.pillar === p.label),`,
  `  })),`,
  `);`,
];

/** A pillar's open work — the `<ul>` of plan rows, shown only when the pillar has open items. */
function pillarItems(): UiNode {
  return {
    attrs: [
      { kind: "static", name: "class", value: "vow-roadmap__items" },
      { expr: "p.open.length > 0", kind: "cond", type: "if" },
    ],
    children: [planRow("p.open", true)],
    kind: "element",
    tag: "ul",
  };
}

/** One pillar `<section>` — its title + open-count + horizon (the compass head), then its open plan rows.
 *  Grouped by pillar, in NORTH_STAR order (not by date). */
function mapPillar(): UiNode {
  return {
    attrs: [{ kind: "static", name: "class", value: "vow-compass__pillar" }],
    children: [
      classed("header", "vow-compass__head", [
        classed("div", "vow-compass__heading", [
          classed("h3", "vow-compass__title", [{ expr: "p.title", kind: "interp" }]),
          classed("span", "vow-compass__count", [
            { expr: "p.open.length", kind: "interp" },
            txt(" open"),
          ]),
        ]),
        classed("p", "vow-compass__horizon", [{ expr: "p.horizon", kind: "interp" }]),
      ]),
      pillarItems(),
    ],
    for: { as: "p", each: "groups", key: "p.title" },
    kind: "element",
    tag: "section",
  };
}

/** The map view tree — a `<section>` per north-star pillar, in NORTH_STAR order. */
function mapView(): UiNode {
  return classed("div", "vow-compass", [mapPillar()]);
}

/**
 * The plan map component — a fixed `<VowPlanMap>` reading the live local plan (`usePlan`, the SQLite DAG),
 * grouped by **pillar** (the north-star throughline). The forward lens on the local plan: what each enduring
 * capability has open, toward its horizon — the compass-local.
 */
export function emitPlanMapSfc(): string {
  return planSfc({
    doc: ["Generated — the local plan as a compass: open work per north-star pillar. Do not edit."],
    name: "VowPlanMap",
    setup: MAP_SCRIPT,
    view: mapView(),
  });
}
