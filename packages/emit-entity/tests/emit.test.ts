import { expect, test } from "vite-plus/test";
import { type Vow as VowNode } from "@vow/core";
import { emitEntityModule, emitEntityTest } from "../src/index.ts";

const task: VowNode = {
  id: "vow_task",
  slug: "task",
  intent: "A task someone must do",
  children: [],
  fields: [
    { name: "title", type: "text", required: true },
    { name: "done", type: "boolean", required: false },
  ],
  proof: [],
  fulfills: { kind: "emit", as: "entity" },
};

test("emitEntityModule generates an interface and a validating factory", () => {
  const code = emitEntityModule(task);
  expect(code).toContain("export interface Task {");
  expect(code).toContain("title: string;");
  expect(code).toContain("done: boolean;");
  expect(code).toContain("export function createTask(input: Partial<Task>): Task");
  expect(code).toContain("'title' is required");
});

test("emitEntityTest derives a suite from the fields — happy path + reject-per-required", () => {
  const code = emitEntityTest(task);
  expect(code).toContain('import { createTask } from "./task.ts";');
  expect(code).toContain("a valid Task is created");
  expect(code).toContain("rejects a Task missing the required 'title'");
  expect(code).toContain("toThrow()");
});

test("the entity emitters fail fast on a non-entity vow", () => {
  const vue: VowNode = { ...task, fulfills: { kind: "emit", as: "vue" } };
  expect(() => emitEntityModule(vue)).toThrow();
  expect(() => emitEntityTest(vue)).toThrow();
});
