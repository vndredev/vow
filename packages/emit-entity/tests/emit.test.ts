import { expect, test } from "vite-plus/test";
import { type Vow as VowNode, uncoveredScenarios } from "@vow/core";
import { emitEntityModule, emitEntityTest, entityProves } from "../src/index.ts";

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

test("entityProves derives the proven scenarios from the fields (happy + reject-per-required)", () => {
  expect(entityProves(task)).toEqual([
    "Eine gültige Task entsteht aus ihren Pflichtfeldern",
    "Eine Task ohne 'title' wird abgelehnt",
  ]);
});

test("emitEntityTest names each generated test after its proven scenario", () => {
  const code = emitEntityTest(task);
  expect(code).toContain('test("Eine gültige Task entsteht aus ihren Pflichtfeldern"');
  expect(code).toContain("test(\"Eine Task ohne 'title' wird abgelehnt\"");
  expect(code).toContain("toThrow()");
});

test("scenario-coverage: every derived prove has a matching generated test", () => {
  const code = emitEntityTest(task);
  const testNames = [...code.matchAll(/test\("([^"]+)"/g)].map((m) => m[1] ?? "");
  expect(uncoveredScenarios(entityProves(task), testNames)).toEqual([]);
});

test("the entity emitters fail fast on a non-entity vow", () => {
  const vue: VowNode = { ...task, fulfills: { kind: "emit", as: "vue" } };
  expect(() => emitEntityModule(vue)).toThrow();
  expect(() => emitEntityTest(vue)).toThrow();
});
