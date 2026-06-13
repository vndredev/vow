import {
  EVENT_LAYOUTS,
  emitEventTraceSfc,
  emitView,
  eventLayout,
  eventLayouts,
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

test("events: { as } renders the layout's component; a missing `as` defaults to trace", () => {
  expect(emitView(view([{ type: "events", value: { as: "trace" } }]))).toContain("<VowEventTrace");
  expect(emitView(view([{ type: "events", value: {} }]))).toContain("<VowEventTrace");
});

test("an unknown events layout throws — no dangling import to a never-materialised component", () => {
  expect(() => emitView(view([{ type: "events", value: { as: "table" } }]))).toThrow(
    /unknown events layout/u,
  );
  expect(() => eventLayout({ as: "calendar" })).toThrow(/unknown events layout/u);
});

test("eventLayouts collects the validated layouts a view uses (mapNode + plugin agree)", () => {
  const vow = view([
    { type: "events", value: { as: "trace" } },
    { type: "events", value: {} },
  ]);
  expect([...eventLayouts(vow)].toSorted()).toEqual(["trace"]);
});

test("EVENT_LAYOUTS maps each layout to its VowEvent* component", () => {
  expect(EVENT_LAYOUTS).toEqual({ trace: "VowEventTrace" });
});

test("the event trace SFC is a valid, store-bound SFC", () => {
  const sfc = emitEventTraceSfc();
  expect(sfc).toContain('<script setup lang="ts">');
  expect(sfc).toContain("useEvents");
  expect(sfc).toContain("@vow/store");
  expect(sfc).toContain("</template>");
});

test("the event trace SFC binds to the store's items + state", () => {
  const sfc = emitEventTraceSfc();
  expect(sfc).toContain("const { items, state } = useEvents();");
});

test("the trace SFC shows the list only when the feed has items (no bare header when empty)", () => {
  const sfc = emitEventTraceSfc();
  expect(sfc).toContain('v-if="items.length > 0"');
});

test("the trace SFC carries the loading / error / empty status messages, mutually exclusive", () => {
  const sfc = emitEventTraceSfc();
  expect(sfc).toContain('v-if="state.loading && !state.error && items.length === 0"');
  expect(sfc).toContain("Loading…");
  expect(sfc).toContain('v-if="state.error && items.length === 0"');
  expect(sfc).toContain("Couldn’t load events");
  expect(sfc).toContain('v-if="!state.loading && !state.error && items.length === 0"');
  expect(sfc).toContain("No events yet.");
});

test("the trace SFC loops over items and renders ts + kind for each entry", () => {
  const sfc = emitEventTraceSfc();
  expect(sfc).toContain('v-for="it in items"');
  expect(sfc).toContain(':key="it.ts"');
  expect(sfc).toContain("{{ it.ts }}");
  expect(sfc).toContain("{{ it.kind }}");
});

test("the trace SFC renders optional fields (issue, phase, detail) only when present", () => {
  const sfc = emitEventTraceSfc();
  expect(sfc).toContain('v-if="it.issue"');
  expect(sfc).toContain("{{ it.issue }}");
  expect(sfc).toContain('v-if="it.phase"');
  expect(sfc).toContain("{{ it.phase }}");
  expect(sfc).toContain('v-if="it.detail"');
  expect(sfc).toContain("{{ it.detail }}");
});
