import { expect, test } from "vite-plus/test";
import { type Vow } from "@vow/core";
import { emitView, referencedPrimitives } from "../src/index.ts";

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

test("a primitive placed directly in a view renders as its component + imports its adapter", () => {
  const sfc = emitView(view([{ type: "button", value: { variant: "outline", label: "Save" } }]));
  expect(sfc).toContain('import Button from "./Button.vue";');
  expect(sfc).toContain(`<Button :variant="'outline'" :label="'Save'" />`);
});

test("the reserved model: key on a view primitive becomes a v-model", () => {
  const sfc = emitView(
    view([{ type: "checkbox", value: { label: "Subscribe", model: "subscribed" } }]),
  );
  expect(sfc).toContain('import Checkbox from "./Checkbox.vue";');
  expect(sfc).toContain('v-model="subscribed"');
});

test("referencedPrimitives lists the primitives a view places directly (the closed registry)", () => {
  const v = view([
    { type: "button", value: { label: "Go" } },
    { type: "text", value: "hi" },
  ]);
  expect(referencedPrimitives(v)).toEqual(["Button"]);
});

test("an unknown component throws (the closed primitive/view vocabulary)", () => {
  expect(() => emitView(view([{ type: "nope", value: {} }]))).toThrow(/unknown view component/);
});

test("the view is wrapped in a vow-app root", () => {
  expect(emitView(view([{ type: "text", value: "hello" }]))).toContain('<div class="vow-app">');
});
