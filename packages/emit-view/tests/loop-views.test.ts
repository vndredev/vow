import {
  LOOP_LAYOUTS,
  emitAgentLoopStatusSfc,
  emitView,
  loopLayout,
  loopLayouts,
} from "../src/index.ts";
import { expect, test } from "vite-plus/test";
import type { Vow } from "@vow/core";

/**
 * The agent-loop status view element (`loop: { as: status }`) — the loop made renderable inside a `.vow.md`,
 * mirroring `events: { as: trace }`. These pin the layout dispatch (mapNode + the plugin agree on the one
 * component to materialise) and the emitted SFC's store binding (`useAgentLoopStatus`), so the cockpit's
 * loop pane can never render a component the plugin didn't write.
 */

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

test("loop: { as } renders the layout's component; a missing `as` defaults to status", () => {
  expect(emitView(view([{ type: "loop", value: { as: "status" } }]))).toContain(
    "<VowAgentLoopStatus",
  );
  expect(emitView(view([{ type: "loop", value: {} }]))).toContain("<VowAgentLoopStatus");
});

test("an unknown loop layout throws — no dangling import to a never-materialised component", () => {
  expect(() => emitView(view([{ type: "loop", value: { as: "graph" } }]))).toThrow(
    /unknown loop layout/u,
  );
  expect(() => loopLayout({ as: "control" })).toThrow(/unknown loop layout/u);
});

test("loopLayouts collects the validated layouts a view uses (mapNode + plugin agree)", () => {
  const vow = view([
    { type: "loop", value: { as: "status" } },
    { type: "loop", value: {} },
  ]);
  expect([...loopLayouts(vow)].toSorted()).toEqual(["status"]);
});

test("LOOP_LAYOUTS maps each layout to its VowAgentLoop* component", () => {
  expect(LOOP_LAYOUTS).toEqual({ status: "VowAgentLoopStatus" });
});

test("the loop-status SFC is a valid, store-bound SFC", () => {
  const sfc = emitAgentLoopStatusSfc();
  expect(sfc).toContain('<script setup lang="ts">');
  expect(sfc).toContain("useAgentLoopStatus");
  expect(sfc).toContain("@vow/store");
  expect(sfc).toContain("</template>");
});

test("the loop-status SFC binds to the store's status + state", () => {
  const sfc = emitAgentLoopStatusSfc();
  expect(sfc).toContain("const { status, state } = useAgentLoopStatus();");
});

test("the loop-status SFC reads one run-state truth — running XOR idle", () => {
  const sfc = emitAgentLoopStatusSfc();
  expect(sfc).toContain('v-if="status.running"');
  expect(sfc).toContain('v-if="!status.running"');
  expect(sfc).toContain("Autonomy on");
  expect(sfc).toContain("Autonomy idle");
});

test("the loop-status SFC shows the round's metrics (round, backlog, open PRs)", () => {
  const sfc = emitAgentLoopStatusSfc();
  expect(sfc).toContain("{{ status.round }}");
  expect(sfc).toContain("{{ status.backlog }}");
  expect(sfc).toContain("{{ status.openPrs }}");
});

test("the loop-status SFC renders the last-round timestamp only when the loop has advanced", () => {
  const sfc = emitAgentLoopStatusSfc();
  expect(sfc).toContain('v-if="status.lastRound"');
  expect(sfc).toContain("{{ status.lastRound }}");
});

test("the loop-status SFC carries the loading / failed messages, mutually exclusive", () => {
  const sfc = emitAgentLoopStatusSfc();
  expect(sfc).toContain('v-if="state.loading && !state.error"');
  expect(sfc).toContain("Loading…");
  expect(sfc).toContain('v-if="state.error"');
  expect(sfc).toContain("Couldn’t load the loop status");
  expect(sfc).toContain('v-if="!state.loading && !state.error"');
});
