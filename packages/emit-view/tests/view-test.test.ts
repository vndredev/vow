import {
  emitFormTest,
  emitViewTest,
  formProves,
  renderScenarios,
  viewProves,
} from "../src/index.ts";
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

/** A form vow over the task entity — only the slug drives the form-test name. */
const addTaskForm: Vow = {
  children: [],
  fields: [],
  form: { of: "task", submit: "Add task" },
  fulfills: { as: "form", kind: "emit" },
  id: "vow_addtask",
  intent: "Add a task",
  proof: [],
  slug: "add-task",
};

test("formProves derives the interaction scenario only when the entity has a required field", () => {
  expect(formProves(addTaskForm, true)).toEqual(["The AddTask form rejects an incomplete submit"]);
  expect(formProves(addTaskForm, false)).toEqual([]);
});

test("emitFormTest mounts the form + submits it empty, asserting an error surfaces", () => {
  const code = emitFormTest(addTaskForm, true);
  expect(code).toContain(`import AddTask from "./add-task.vue";`);
  expect(code).toContain(`test("The AddTask form rejects an incomplete submit", async () => {`);
  expect(code).toContain(`await wrapper.find("form").trigger("submit");`);
  expect(code).toContain(`expect(wrapper.find('[role="alert"]').exists()).toBe(true);`);
});
