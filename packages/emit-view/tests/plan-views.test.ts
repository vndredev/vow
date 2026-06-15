import {
  PLAN_LAYOUTS,
  emitPlanBacklogSfc,
  emitPlanMapSfc,
  emitPlanNowNextSfc,
  emitView,
  planLayout,
  planLayouts,
} from "../src/index.ts";
import { expect, test } from "vite-plus/test";
import type { Vow } from "@vow/core";

/** A view-only vow (a `## view`) with a given node list. */
const view = (nodes: Vow["view"]): Vow => ({
  children: [],
  fields: [],
  fulfills: { as: "view", kind: "emit" },
  id: "vow_v",
  intent: "A page",
  proof: [],
  slug: "page",
  view: nodes,
});

test("plan: { as } renders the layout's component; a missing `as` defaults to now-next", () => {
  expect(emitView(view([{ type: "plan", value: { as: "backlog" } }]))).toContain("<VowPlanBacklog");
  expect(emitView(view([{ type: "plan", value: { as: "map" } }]))).toContain("<VowPlanMap");
  expect(emitView(view([{ type: "plan", value: { as: "now-next" } }]))).toContain(
    "<VowPlanNowNext",
  );
  expect(emitView(view([{ type: "plan", value: {} }]))).toContain("<VowPlanNowNext");
});

test("an unknown plan layout throws — no dangling import to a never-materialised component", () => {
  expect(() => emitView(view([{ type: "plan", value: { as: "table" } }]))).toThrow(
    /unknown plan layout/u,
  );
  expect(() => planLayout({ as: "nxt" })).toThrow(/unknown plan layout/u);
});

test("planLayouts collects the validated layouts a view uses (mapNode + plugin agree)", () => {
  const vow = view([
    { type: "plan", value: { as: "map" } },
    { type: "plan", value: {} },
  ]);
  expect([...planLayouts(vow)].toSorted()).toEqual(["map", "now-next"]);
});

test("PLAN_LAYOUTS maps each layout to its VowPlan* component", () => {
  expect(PLAN_LAYOUTS).toEqual({
    backlog: "VowPlanBacklog",
    map: "VowPlanMap",
    "now-next": "VowPlanNowNext",
  });
});

test("each plan SFC emitter produces a valid, store-bound SFC reading usePlan", () => {
  for (const sfc of [emitPlanNowNextSfc(), emitPlanBacklogSfc(), emitPlanMapSfc()]) {
    expect(sfc).toContain('<script setup lang="ts">');
    expect(sfc).toContain("usePlan");
    expect(sfc).toContain("@vow/store");
    expect(sfc).toContain("</template>");
    // The shared setup line — the local plan, its ready-queue, blocked set, and fetch state.
    expect(sfc).toContain("const { items, ready, blocked, state } = usePlan();");
  }
});

test("each plan SFC is READ-ONLY — no action buttons (the plan is agent-driven, never browser-written)", () => {
  for (const sfc of [emitPlanNowNextSfc(), emitPlanBacklogSfc(), emitPlanMapSfc()]) {
    // No close/reopen, no start-work, no session link — unlike the live issue views.
    expect(sfc).not.toContain("Button");
    expect(sfc).not.toContain("startWork");
    expect(sfc).not.toContain("closeIssue");
  }
});

test("each plan SFC shows the layout only when the plan has items (no bare header when empty)", () => {
  for (const sfc of [emitPlanNowNextSfc(), emitPlanBacklogSfc(), emitPlanMapSfc()]) {
    expect(sfc).toContain('v-if="items.length > 0"');
  }
});

test("each plan SFC carries the plan-specific loading / error / empty status messages, mutually exclusive", () => {
  for (const sfc of [emitPlanNowNextSfc(), emitPlanBacklogSfc(), emitPlanMapSfc()]) {
    expect(sfc).toContain('v-if="state.loading && !state.error && items.length === 0"');
    expect(sfc).toContain("Loading the plan");
    expect(sfc).toContain('v-if="state.error && items.length === 0"');
    expect(sfc).toContain("Couldn't load the plan");
    expect(sfc).toContain('v-if="!state.loading && !state.error && items.length === 0"');
    expect(sfc).toContain("Nothing planned yet.");
  }
});

test("the now-next SFC derives Now from `doing` and Next from the priority-ordered ready-queue", () => {
  const sfc = emitPlanNowNextSfc();
  // Now = the items in flight.
  expect(sfc).toContain('items.filter((it) => it.status === "doing")');
  // Next = each ready id mapped to its item, preserving the ready-queue's priority order.
  expect(sfc).toContain("ready.map((id) => items.find((it) => it.id === id))");
  // Both sections are headed.
  expect(sfc).toContain(">Now<");
  expect(sfc).toContain(">Next<");
});

test("the backlog SFC pools the unstarted items (backlog / blocked / parked), each with its status badge", () => {
  const sfc = emitPlanBacklogSfc();
  expect(sfc).toContain('it.status === "backlog"');
  expect(sfc).toContain('it.status === "blocked"');
  expect(sfc).toContain('it.status === "parked"');
  // The status badge is shown for the pool (the now/next rows derive their section from status instead).
  expect(sfc).toContain(':tone="tone(it.status)"');
  expect(sfc).toContain(">Backlog<");
});

test("the map SFC groups the local plan by north-star pillar, matched off the item's own pillar", () => {
  const sfc = emitPlanMapSfc();
  // The four pillars are baked in from the single source (@vow/observability).
  expect(sfc).toContain('"label":"pillar:describe-to-app"');
  expect(sfc).toContain('"label":"pillar:mechanical-integrity"');
  // The pillar comes straight off the plan item — not resolved from issue labels.
  expect(sfc).toContain("it.pillar === p.label");
  // Each pillar section leads with its title + horizon + open count (the compass head, reused).
  expect(sfc).toContain('class="vow-compass__pillar"');
  expect(sfc).toContain('class="vow-compass__horizon"');
  expect(sfc).toContain('v-for="p in groups"');
  expect(sfc).toContain('class="vow-compass__count"');
  expect(sfc).toContain("p.open.length");
});

test("each plan SFC's status messages are live regions — the swap is announced (WCAG 4.1.3)", () => {
  for (const sfc of [emitPlanNowNextSfc(), emitPlanBacklogSfc(), emitPlanMapSfc()]) {
    expect(sfc).toContain(
      '<p class="vow-empty" role="status" aria-live="polite" v-if="state.loading && !state.error && items.length === 0">Loading the plan…</p>',
    );
    expect(sfc).toContain(
      '<p class="vow-empty" role="alert" aria-live="assertive" v-if="state.error && items.length === 0">Couldn\'t load the plan</p>',
    );
  }
});
