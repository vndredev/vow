import {
  FEED_LAYOUTS,
  emitFeedListSfc,
  emitFeedTraceSfc,
  emitView,
  feedLayout,
  feedLayouts,
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
  expect(emitView(view([{ type: "events", value: { as: "trace" } }]))).toContain("<VowFeedTrace");
  expect(emitView(view([{ type: "events", value: { as: "list" } }]))).toContain("<VowFeedList");
  expect(emitView(view([{ type: "events", value: {} }]))).toContain("<VowFeedTrace");
});

test("an unknown feed layout throws — no dangling import to a never-materialised component", () => {
  expect(() => emitView(view([{ type: "events", value: { as: "board" } }]))).toThrow(
    /unknown feed layout/u,
  );
  expect(() => feedLayout({ as: "tabel" })).toThrow(/unknown feed layout/u);
});

test("feedLayouts collects the validated layouts a view uses (mapNode + plugin agree)", () => {
  const vow = view([
    { type: "events", value: { as: "trace" } },
    { type: "events", value: {} },
  ]);
  expect([...feedLayouts(vow)].toSorted()).toEqual(["trace"]);
});

test("FEED_LAYOUTS maps each layout to its VowFeed* component", () => {
  expect(FEED_LAYOUTS).toEqual({
    list: "VowFeedList",
    trace: "VowFeedTrace",
  });
});

test("each feed SFC emitter produces a valid, store-bound SFC", () => {
  for (const sfc of [emitFeedTraceSfc(), emitFeedListSfc()]) {
    expect(sfc).toContain('<script setup lang="ts">');
    expect(sfc).toContain("useFeed");
  }
});
