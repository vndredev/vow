import {
  LOOP_LAYOUTS,
  emitAgentLoopStatusSfc,
  emitAgentPanelSfc,
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
  expect(emitView(view([{ type: "loop", value: { as: "agents" } }]))).toContain("<VowAgentPanel");
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

test("LOOP_LAYOUTS maps each layout to its VowAgent* component", () => {
  expect(LOOP_LAYOUTS).toEqual({ agents: "VowAgentPanel", status: "VowAgentLoopStatus" });
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

test("the loop-status SFC reads one run-state truth — a running Badge XOR an idle Badge", () => {
  const sfc = emitAgentLoopStatusSfc();
  // Two mutually-exclusive run-state Badges, tone by `running` (success on, neutral idle).
  expect(sfc).toContain("<Badge");
  expect(sfc).toContain('v-if="status.running"');
  expect(sfc).toContain('v-if="!status.running"');
  expect(sfc).toContain('label="Autonomy on"');
  expect(sfc).toContain('tone="success"');
  expect(sfc).toContain('label="Autonomy idle"');
  expect(sfc).toContain('tone="neutral"');
});

test("the loop-status SFC shows the round's metrics as a Stats/Stat stat-card grid", () => {
  const sfc = emitAgentLoopStatusSfc();
  // The metrics compose the Stats container + a Stat card per count (value bound, label the metric name).
  expect(sfc).toContain("<Stats");
  expect(sfc).toContain("<Stat");
  expect(sfc).toContain(':value="status.round"');
  expect(sfc).toContain('label="Round"');
  expect(sfc).toContain(':value="status.backlog"');
  expect(sfc).toContain('label="Backlog"');
  expect(sfc).toContain(':value="status.openPrs"');
  expect(sfc).toContain('label="Open PRs"');
});

test("the loop-status SFC renders the last-round Stat only when the loop has advanced", () => {
  const sfc = emitAgentLoopStatusSfc();
  expect(sfc).toContain('v-if="status.lastRound"');
  expect(sfc).toContain(':value="status.lastRound"');
  expect(sfc).toContain('label="Last round"');
});

test("the loop-status SFC imports the Badge + Stats/Stat primitives it composes", () => {
  const sfc = emitAgentLoopStatusSfc();
  expect(sfc).toContain('import Badge from "./Badge.vue";');
  expect(sfc).toContain('import Stats from "./Stats.vue";');
  expect(sfc).toContain('import Stat from "./Stat.vue";');
});

test("the loop-status SFC carries the loading / failed messages, mutually exclusive", () => {
  const sfc = emitAgentLoopStatusSfc();
  expect(sfc).toContain('v-if="state.loading && !state.error"');
  expect(sfc).toContain("Loading…");
  expect(sfc).toContain('v-if="state.error"');
  expect(sfc).toContain("Couldn’t load the loop status");
  expect(sfc).toContain('v-if="!state.loading && !state.error"');
});

test("the agent-panel SFC is a valid, store-bound SFC", () => {
  const sfc = emitAgentPanelSfc();
  expect(sfc).toContain('<script setup lang="ts">');
  expect(sfc).toContain("useEvents");
  expect(sfc).toContain("activeRunsFrom");
  expect(sfc).toContain("@vow/store");
  expect(sfc).toContain("</template>");
});

test("the agent-panel SFC derives active runs via computed()", () => {
  const sfc = emitAgentPanelSfc();
  expect(sfc).toContain("computed");
  expect(sfc).toContain("activeRunsFrom(items)");
  expect(sfc).toContain("const runs = computed(() => activeRunsFrom(items));");
});

test("the agent-panel SFC loops over runs with Card per active agent", () => {
  const sfc = emitAgentPanelSfc();
  expect(sfc).toContain("v-for");
  expect(sfc).toContain("run in runs");
  expect(sfc).toContain("<Card");
  expect(sfc).toContain("<CardHeader");
  expect(sfc).toContain("<CardBody");
});

test("the agent-panel SFC shows issue + specialist + phase as Badges in the card header", () => {
  const sfc = emitAgentPanelSfc();
  expect(sfc).toContain(':label="`#${run.issue}`"');
  expect(sfc).toContain('v-if="run.specialist"');
  expect(sfc).toContain(':label="run.specialist"');
  expect(sfc).toContain('v-if="run.phase"');
  expect(sfc).toContain(':label="run.phase"');
});

test("the agent-panel SFC shows the tool feed as a Table of tool rows", () => {
  const sfc = emitAgentPanelSfc();
  expect(sfc).toContain("<Table");
  expect(sfc).toContain("<TableRow");
  expect(sfc).toContain("<TableCell");
  expect(sfc).toContain("tool in run.tools");
  expect(sfc).toContain(':key="tool.ts"');
  expect(sfc).toContain("time(tool.ts)");
  expect(sfc).toContain(':label="tool.name"');
  expect(sfc).toContain(':tone="toolTone(tool.name)"');
  expect(sfc).toContain("tool.summary");
});

test("the agent-panel SFC shows the waiting message when no tool events exist", () => {
  const sfc = emitAgentPanelSfc();
  expect(sfc).toContain("Waiting for tool events");
  expect(sfc).toContain('v-if="run.tools.length === 0"');
});

test("the agent-panel SFC carries the loading / failed / empty status messages", () => {
  const sfc = emitAgentPanelSfc();
  expect(sfc).toContain("Loading…");
  expect(sfc).toContain("Couldn’t load agents");
  expect(sfc).toContain("No active agents.");
});

test("the agent-panel SFC imports the Card + Table primitives it composes", () => {
  const sfc = emitAgentPanelSfc();
  expect(sfc).toContain('import Card from "./Card.vue";');
  expect(sfc).toContain('import CardHeader from "./CardHeader.vue";');
  expect(sfc).toContain('import CardBody from "./CardBody.vue";');
  expect(sfc).toContain('import Table from "./Table.vue";');
  expect(sfc).toContain('import TableRow from "./TableRow.vue";');
  expect(sfc).toContain('import TableCell from "./TableCell.vue";');
  expect(sfc).toContain('import Badge from "./Badge.vue";');
});
