import { expect, test } from "vite-plus/test";
import { type Vow as VowNode } from "@vow/core";
import { emitViewSfc } from "../src/index.ts";

const entity: VowNode = {
  id: "vow_task",
  slug: "task",
  intent: "A task",
  children: [],
  fields: [
    { name: "title", type: "text", required: true },
    { name: "done", type: "boolean", required: false },
  ],
  proof: [],
  fulfills: { kind: "emit", as: "entity" },
};
const view: VowNode = {
  id: "vow_tasks",
  slug: "tasks",
  intent: "Aufgaben verwalten",
  of: "task",
  children: [],
  fields: [],
  proof: [],
  fulfills: { kind: "emit", as: "view" },
};

test("emitViewSfc renders a typed, read-only list over the entity", () => {
  const sfc = emitViewSfc(view, entity);
  expect(sfc).toContain('import type { Task } from "./task.ts";');
  expect(sfc).toContain("defineProps<{ items: Task[] }>()");
  expect(sfc).toContain('v-for="(item, i) in items"');
  expect(sfc).toContain("{{ item.title }}");
  expect(sfc).toContain("item.done ? '✓' : '–'");
  expect(sfc).toContain("Aufgaben verwalten");
});

test("emitViewSfc fails fast when the target is not an emit view / entity", () => {
  expect(() => emitViewSfc(entity, entity)).toThrow();
  expect(() => emitViewSfc(view, view)).toThrow();
});
