import { expect, test } from "vite-plus/test";
import { type Vow } from "@vow/core";
import { emitView } from "../src/index.ts";

/** Build a view-only vow (a `## view`) with a given component list. */
const view = (nodes: Vow["view"]): Vow => ({
  id: "vow_v",
  slug: "page",
  intent: "A page",
  children: [],
  fields: [],
  proof: [],
  fulfills: { kind: "emit", as: "view" },
  view: nodes,
});

test("hero expands to a column Flex with eyebrow, title and lead", () => {
  const sfc = emitView(
    view([{ type: "hero", value: { eyebrow: "vow", title: "The framework", lead: "Build it" } }]),
  );
  expect(sfc).toContain('<Flex :direction="\'column\'" :gap="3">');
  expect(sfc).toContain("<span>vow</span>");
  expect(sfc).toContain("<h1>The framework</h1>");
  expect(sfc).toContain("<p>Build it</p>");
  expect(sfc).toContain('import Flex from "./Flex.vue";');
});

test("features expand to a 3-column Grid of Boxes", () => {
  const sfc = emitView(
    view([
      {
        type: "features",
        value: [
          { title: "A", body: "aa" },
          { title: "B", body: "bb" },
        ],
      },
    ]),
  );
  expect(sfc).toContain('<Grid :columns="3" :gap="4">');
  expect(sfc).toContain('<Box :p="5">');
  expect(sfc).toContain("<h3>A</h3>");
  expect(sfc).toContain("<p>aa</p>");
});

test("list references a generated view by entity slug and imports it", () => {
  const sfc = emitView(view([{ type: "list", value: "task" }]), ["task"]);
  expect(sfc).toContain("<Task />");
  expect(sfc).toContain('import Task from "./Task.vue";');
});

test("list with an unknown entity throws", () => {
  expect(() => emitView(view([{ type: "list", value: "ghost" }]), ["task"])).toThrow(
    /unknown entity/,
  );
});

test("primitives are the escape hatch: flex with props + children", () => {
  const sfc = emitView(
    view([{ type: "flex", value: { direction: "column", gap: 4, children: [{ text: "hi" }] } }]),
  );
  expect(sfc).toContain('<Flex :direction="\'column\'" :gap="4">hi</Flex>');
});

test("an unknown component throws", () => {
  expect(() => emitView(view([{ type: "nope", value: {} }]))).toThrow(/unknown view component/);
});

test("the view is wrapped in a vow-app root", () => {
  expect(emitView(view([{ type: "text", value: "hello" }]))).toContain('<div class="vow-app">');
});
