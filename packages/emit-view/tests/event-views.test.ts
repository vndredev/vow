import {
  EVENT_LAYOUTS,
  emitEventTraceSfc,
  emitView,
  eventLayout,
  eventLayouts,
} from "../src/index.ts";
import { expect, test } from "vite-plus/test";
import type { Vow } from "@vow/core";

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
  expect(() => emitView(view([{ type: "events", value: { as: "board" } }]))).toThrow(
    /unknown events layout/u,
  );
  expect(() => eventLayout({ as: "unknown" })).toThrow(/unknown events layout/u);
});

test("eventLayouts collects the validated layouts a view uses (mapNode + plugin agree)", () => {
  const vow = view([
    { type: "events", value: { as: "trace" } },
    { type: "events", value: {} },
  ]);
  expect([...eventLayouts(vow)]).toEqual(["trace"]);
});

test("EVENT_LAYOUTS maps each layout to its VowEvent* component", () => {
  expect(EVENT_LAYOUTS).toEqual({ trace: "VowEventTrace" });
});

test("the event trace SFC emitter produces a valid, store-bound SFC", () => {
  const sfc = emitEventTraceSfc();
  expect(sfc).toContain('<script setup lang="ts">');
  expect(sfc).toContain("useEvents");
  expect(sfc).toContain("@vow/store");
  expect(sfc).toContain("</template>");
});

test("the event trace SFC carries loading / error / empty status messages, mutually exclusive", () => {
  const sfc = emitEventTraceSfc();
  expect(sfc).toContain('v-if="state.loading && !state.error && sorted.length === 0"');
  expect(sfc).toContain("Connecting");
  expect(sfc).toContain('v-if="state.error && sorted.length === 0"');
  expect(sfc).toContain('v-if="!state.loading && !state.error && sorted.length === 0"');
  expect(sfc).toContain("No events yet.");
});

test("the event trace SFC renders events newest-first with a computed sorted list", () => {
  const sfc = emitEventTraceSfc();
  expect(sfc).toContain("computed");
  expect(sfc).toContain("sorted");
  expect(sfc).toContain("reverse()");
});

test("the event trace SFC shows the layout only when sorted has items", () => {
  const sfc = emitEventTraceSfc();
  expect(sfc).toContain('v-if="sorted.length > 0"');
});

test("the event trace SFC renders each event field with proper optional guards", () => {
  const sfc = emitEventTraceSfc();
  expect(sfc).toContain("ev.ts");
  expect(sfc).toContain("ev.kind");
  expect(sfc).toContain('v-if="ev.issue"');
  expect(sfc).toContain('v-if="ev.pr"');
  expect(sfc).toContain('v-if="ev.phase"');
  expect(sfc).toContain('v-if="ev.detail"');
});
