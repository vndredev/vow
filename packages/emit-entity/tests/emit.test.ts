import { emitEntityModule, emitEntityTest, entityProves } from "../src/index.ts";
import { expect, test } from "vite-plus/test";
import type { Vow as VowNode } from "@vow/core";

const task: VowNode = {
  children: [],
  fields: [
    { name: "title", required: true, type: "text" },
    { name: "done", required: false, type: "boolean" },
  ],
  fulfills: { as: "entity", kind: "emit" },
  id: "vow_task",
  intent: "A task someone must do",
  proof: [],
  slug: "task",
};

test("emitEntityModule generates a zod schema, its inferred type, and a validating factory", () => {
  const code = emitEntityModule(task);
  expect(code).toContain('import { z } from "zod";');
  expect(code).toContain("export const TaskSchema = z.object({");
  expect(code).toContain('title: z.string().min(1, "title is required"),');
  expect(code).toContain("done: z.boolean(),");
  expect(code).toContain("export type Task = z.infer<typeof TaskSchema>;");
  expect(code).toContain("export function createTask(input: Partial<Task>): Task");
  expect(code).toContain("return TaskSchema.parse({");
  // Required -> passed raw, so zod rejects it.
  expect(code).toContain("title: input.title,");
});

test("every entity gets an implicit auto-id the factory generates", () => {
  const code = emitEntityModule(task);
  expect(code).toContain("id: z.string(),");
  expect(code).toContain("id: input.id ?? crypto.randomUUID(),");
});

test("a select field becomes a string-literal union with a default", () => {
  const ticket: VowNode = {
    ...task,
    fields: [
      { name: "title", required: true, type: "text" },
      { name: "status", options: ["todo", "doing", "done"], required: false, type: "select" },
    ],
    id: "vow_ticket",
    slug: "ticket",
  };
  const code = emitEntityModule(ticket);
  expect(code).toContain('status: z.enum(["todo", "doing", "done"]),');
  expect(code).toContain('status: input.status ?? "todo"');
});

test("a reference field is the target entity's id (string)", () => {
  const issue: VowNode = {
    ...task,
    fields: [
      { name: "title", required: true, type: "text" },
      { name: "assignee", ref: "user", required: false, type: "reference" },
    ],
    id: "vow_issue",
    slug: "issue",
  };
  const code = emitEntityModule(issue);
  expect(code).toContain("assignee: z.string(),");
  expect(code).toContain('assignee: input.assignee ?? ""');
});

test("a date field is a string field (ISO-8601) with an ISO sample value", () => {
  const event: VowNode = {
    ...task,
    fields: [
      { name: "title", required: true, type: "text" },
      { name: "starts", required: true, type: "date" },
    ],
    id: "vow_event",
    slug: "event",
  };
  const code = emitEntityModule(event);
  expect(code).toContain('starts: z.string().min(1, "starts is required"),');
  expect(code).toContain("starts: input.starts,");
  const testCode = emitEntityTest(event);
  expect(testCode).toContain('starts: "2026-01-01"');
  expect(testCode).toContain("Event without 'starts' is rejected");
});

test("a longtext field is a non-empty string in the schema (a textarea in the UI)", () => {
  const note: VowNode = {
    ...task,
    fields: [{ name: "body", required: true, type: "longtext" }],
    id: "vow_note",
    slug: "note",
  };
  const code = emitEntityModule(note);
  expect(code).toContain('body: z.string().min(1, "body is required"),');
  expect(code).toContain("body: input.body,");
});

test("entityProves derives the proven scenarios from the fields", () => {
  expect(entityProves(task)).toEqual([
    "A valid Task is built from its required fields",
    "Task without 'title' is rejected",
  ]);
});

test("emitEntityTest names each generated test after its proven scenario", () => {
  const code = emitEntityTest(task);
  expect(code).toContain('test("A valid Task is built from its required fields"');
  expect(code).toContain("test(\"Task without 'title' is rejected\"");
  expect(code).toContain("toThrow()");
});

test("the entity emitters fail fast on a non-entity vow", () => {
  const bound: VowNode = { ...task, fulfills: { export: "y", kind: "bind", module: "x" } };
  expect(() => emitEntityModule(bound)).toThrow();
  expect(() => emitEntityTest(bound)).toThrow();
});
