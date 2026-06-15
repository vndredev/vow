import { PLAN_SETUP_LINE, PLAN_TONE_LINES, planSection, planSfc } from "./plan-shared.ts";
import type { UiNode } from "./types.ts";
import { el } from "./helpers.ts";

/**
 * Two of the three local-plan SFCs (`usePlan`, the SQLite DAG) — `now-next` and `backlog`. Each is a fixed
 * component the plugin materialises (`map-node.ts`'s `plan:` node points at one). They read `/__vow/plan`
 * live (no baked data) and are READ-ONLY — the plan is driven by the agent / MCP / loop, never the browser.
 * The third, `map` (grouped by north-star pillar), lives in `plan-compass-sfc.ts` (the compass-local).
 *
 * Each is a canonical `Component` rendered through @vow/component — framework-neutral, never raw Vue — and
 * reuses the roadmap's themed card grid (`.vow-roadmap__*`), so a plan row reads like a roadmap card.
 */

/** The `now-next` script — the two derived sections. **Now** = the items in flight (`status === "doing"`);
 *  **Next** = the ready-queue mapped to its items, preserving `ready`'s priority order (the work the loop
 *  pulls next). `ready` is already priority-sorted, so the lookup keeps that order rather than re-deriving it. */
const NOW_NEXT_SCRIPT = [
  PLAN_SETUP_LINE,
  ...PLAN_TONE_LINES,
  `const now = computed(() => items.filter((it) => it.status === "doing"));`,
  `const next = computed(() =>`,
  `  ready.map((id) => items.find((it) => it.id === id)).filter((it) => it !== undefined),`,
  `);`,
];

/** The `now-next` view — two roadmap-band sections: the in-flight work, then the priority-ordered next-up. */
function nowNextView(): UiNode {
  return el("div", [planSection("Now", "now", false), planSection("Next", "next", false)]);
}

/**
 * The plan now-next component — a fixed `<VowPlanNowNext>` reading the live local plan (`usePlan`, the
 * SQLite DAG). Two sections: **Now** (the items currently `doing`) and **Next** (the ready-queue in priority
 * order — the work the loop pulls next). The operator's at-a-glance "what is happening / what is up next".
 */
export function emitPlanNowNextSfc(): string {
  return planSfc({
    doc: ["Generated — the local plan as now/next, read live from /__vow/plan. Do not edit."],
    name: "VowPlanNowNext",
    setup: NOW_NEXT_SCRIPT,
    view: nowNextView(),
  });
}

/** The `backlog` script — the unstarted pool: every item not yet picked up (`backlog`/`blocked`/`parked`). */
const BACKLOG_SCRIPT = [
  PLAN_SETUP_LINE,
  ...PLAN_TONE_LINES,
  `const pool = computed(() =>`,
  `  items.filter(`,
  `    (it) => it.status === "backlog" || it.status === "blocked" || it.status === "parked",`,
  `  ),`,
  `);`,
];

/** The `backlog` view — one roadmap-band section of the unstarted pool, each row carrying its status badge. */
function backlogView(): UiNode {
  return el("div", [planSection("Backlog", "pool", true)]);
}

/**
 * The plan backlog component — a fixed `<VowPlanBacklog>` reading the live local plan (`usePlan`, the SQLite
 * DAG). The unstarted pool: the items still in `backlog`, held `blocked`, or `parked` — what is waiting to
 * be picked up, each carrying its status badge.
 */
export function emitPlanBacklogSfc(): string {
  return planSfc({
    doc: [
      "Generated — the local plan backlog (the unstarted pool), read live from /__vow/plan. Do not edit.",
    ],
    name: "VowPlanBacklog",
    setup: BACKLOG_SCRIPT,
    view: backlogView(),
  });
}
