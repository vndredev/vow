import { expect, test } from "vite-plus/test";
import { expectedScenarios, testNamesIn } from "../src/index.ts";
import type { Vow as VowNode } from "@vow/core";

test("expectedScenarios derives for emit entity, reads ## proves otherwise", () => {
  const entity: VowNode = {
    children: [],
    fields: [{ name: "title", required: true, type: "text" }],
    fulfills: { as: "entity", kind: "emit" },
    id: "vow_e",
    intent: "x",
    proof: [],
    slug: "task",
  };
  expect(expectedScenarios(entity)).toContain("Task without 'title' is rejected");

  const bind: VowNode = {
    children: [],
    fields: [],
    fulfills: { export: "f", kind: "bind", module: "./x.ts" },
    id: "vow_b",
    intent: "x",
    proof: [{ claim: "a discount applies from 10 units" }],
    slug: "total",
  };
  expect(expectedScenarios(bind)).toEqual(["a discount applies from 10 units"]);
});

/** A form vow over the `task` entity — its `of:` is resolved against the entities list. */
const addTaskForm: VowNode = {
  children: [],
  fields: [],
  form: { of: "task", submit: "Add task" },
  fulfills: { as: "form", kind: "emit" },
  id: "vow_addtask",
  intent: "Add a task",
  proof: [],
  slug: "add-task",
};

/** Build the `task` entity with one field of the given requiredness — the form's resolution target. */
function taskEntity(required: boolean): VowNode {
  return {
    children: [],
    fields: [{ name: "title", required, type: "text" }],
    fulfills: { as: "entity", kind: "emit" },
    id: "vow_task",
    intent: "x",
    proof: [],
    slug: "task",
  };
}

test("expectedScenarios resolves a form's entity from the list to decide the submit scenario", () => {
  // The gate (whole-vow list) and plan.ts (entities list) must agree: this pins the entity-lookup seam.
  const withRequired = expectedScenarios(addTaskForm, [taskEntity(true)]);
  expect(withRequired).toContain("The AddTask form rejects an incomplete submit");

  const allOptional = expectedScenarios(addTaskForm, [taskEntity(false)]);
  expect(allOptional).not.toContain("The AddTask form rejects an incomplete submit");

  // No matching entity in the list reads as no required field — the submit scenario is absent.
  const noMatch = expectedScenarios(addTaskForm, []);
  expect(noMatch).not.toContain("The AddTask form rejects an incomplete submit");
});

test("testNamesIn extracts both test() and it() names", () => {
  const src = `test("alpha", () => {});\nit('beta', () => {});`;
  expect(testNamesIn(src)).toEqual(["alpha", "beta"]);
});
