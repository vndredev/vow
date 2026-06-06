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

test("emitViewSfc renders a typed list; boolean fields become the emitted checkbox", () => {
  const sfc = emitViewSfc(view, entity);
  expect(sfc).toContain('import type { Task } from "./task.ts";');
  expect(sfc).toContain('import Checkbox from "./Checkbox.vue";');
  expect(sfc).toContain("defineProps<{ items: Task[] }>()");
  expect(sfc).toContain('v-for="(item, i) in rows"');
  expect(sfc).toContain("{{ item.title }}");
  expect(sfc).toContain('<Checkbox v-model="item.done" label="done" />');
  expect(sfc).toContain("Aufgaben verwalten");
  // ships minimal structural styles (readable list out of the box)
  expect(sfc).toContain("<style scoped>");
});

test("emitViewSfc fails fast when the target is not an emit view / entity", () => {
  expect(() => emitViewSfc(entity, entity)).toThrow();
  expect(() => emitViewSfc(view, view)).toThrow();
});
