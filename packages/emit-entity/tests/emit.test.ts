import { expect, test } from "vite-plus/test";
import { type Vow as VowNode } from "@vow/core";
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

test("a select field becomes a string-literal union with a default", () => {
  const ticket: VowNode = {
    ...task,
    id: "vow_ticket",
    slug: "ticket",
    fields: [
      { name: "title", type: "text", required: true },
      { name: "status", type: "select", required: false, options: ["todo", "doing", "done"] },
    ],
  };
  const code = emitEntityModule(ticket);
  expect(code).toContain('status: "todo" | "doing" | "done";');
  expect(code).toContain('status: input.status ?? "todo"');
});

test("a date field is a string field (ISO-8601) with an ISO sample value", () => {
  const event: VowNode = {
    ...task,
    id: "vow_event",
    slug: "event",
    fields: [
      { name: "title", type: "text", required: true },
      { name: "starts", type: "date", required: true },
    ],
  };
  const code = emitEntityModule(event);
  expect(code).toContain("starts: string;");
  expect(code).toContain("'starts' is required");
  const testCode = emitEntityTest(event);
  expect(testCode).toContain('starts: "2026-01-01"');
  expect(testCode).toContain("Eine Event ohne 'starts' wird abgelehnt");
});

test("entityProves derives the proven scenarios from the fields", () => {
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

test("the entity emitters fail fast on a non-entity vow", () => {
  const bound: VowNode = { ...task, fulfills: { kind: "bind", module: "x", export: "y" } };
  expect(() => emitEntityModule(bound)).toThrow();
  expect(() => emitEntityTest(bound)).toThrow();
});
