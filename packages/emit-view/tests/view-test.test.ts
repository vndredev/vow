import { emitViewTest, renderScenarios, viewProves } from "../src/index.ts";
import { expect, test } from "vite-plus/test";
import type { Vow } from "@vow/core";

/** A view-only vow — only the slug drives the render-test names. */
const tasksView: Vow = {
  children: [],
  fields: [],
  fulfills: { as: "view", kind: "emit" },
  id: "vow_tasks",
  intent: "A page",
  proof: [],
  slug: "tasks",
  view: [],
};

test("renderScenarios names the two proofs after the label", () => {
  expect(renderScenarios("Tasks").map((scenario) => scenario.claim)).toEqual([
    "The Tasks view renders",
    "The Tasks view has no accessibility violations",
  ]);
});

test("viewProves derives a vow's render scenarios from its PascalCase slug", () => {
  expect(viewProves(tasksView)).toEqual([
    "The Tasks view renders",
    "The Tasks view has no accessibility violations",
  ]);
});

test("emitViewTest mounts the page's .vue + runs axe, named after the scenarios", () => {
  const code = emitViewTest(tasksView);
  expect(code).toContain(`import Tasks from "./tasks.vue";`);
  expect(code).toContain(`import { mount } from "@vue/test-utils";`);
  expect(code).toContain(`import axe from "axe-core";`);
  expect(code).toContain(`test("The Tasks view renders", () => {`);
  expect(code).toContain(`const wrapper = mount(Tasks);`);
  expect(code).toContain(`test("The Tasks view has no accessibility violations", async () => {`);
  expect(code).toContain(`const results = await axe.run(wrapper.element);`);
});
