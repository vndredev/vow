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

test("emitViewSfc renders an unstyled, hooked CRUD list over the entity", () => {
  const sfc = emitViewSfc(view, entity);
  expect(sfc).toContain('import { createTask, type Task } from "./task.ts";');
  expect(sfc).toContain('import Checkbox from "./Checkbox.vue";');
  expect(sfc).toContain("defineProps<{ items: Task[] }>()");
  // read + update
  expect(sfc).toContain('v-for="(item, i) in rows"');
  expect(sfc).toContain("{{ item.title }}");
  expect(sfc).toContain('<Checkbox v-model="item.done" label="done" />');
  // create + delete on local state
  expect(sfc).toContain('v-model="draft.title"');
  expect(sfc).toContain('@submit.prevent="add"');
  expect(sfc).toContain("createTask(draft.value)");
  expect(sfc).toContain('@click="remove(i)"');
  // unstyled
  expect(sfc).not.toContain("<style");
});

test("emitViewSfc fails fast when the target is not an emit view / entity", () => {
  expect(() => emitViewSfc(entity, entity)).toThrow();
  expect(() => emitViewSfc(view, view)).toThrow();
});
