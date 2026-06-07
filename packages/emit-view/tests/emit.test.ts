import { expect, test } from "vite-plus/test";
import { type Vow as VowNode } from "@vow/core";
import { emitDefaultView, emitViewSfc, viewComponentName } from "../src/index.ts";

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
  expect(sfc).toContain(
    "const props = withDefaults(defineProps<{ items?: Task[] }>(), { items: () => [] });",
  );
  expect(sfc).toContain('v-for="(item, i) in rows"');
  expect(sfc).toContain("{{ item.title }}");
  expect(sfc).toContain('<Checkbox v-model="item.done" label="done" />');
  expect(sfc).toContain('v-model="draft.title"');
  expect(sfc).toContain('@submit.prevent="add"');
  expect(sfc).toContain("createTask(draft.value)");
  expect(sfc).toContain('@click="remove(i)"');
  expect(sfc).not.toContain("<style");
});

test("emitDefaultView renders a CRUD view straight from the entity — no separate view vow", () => {
  expect(viewComponentName(entity)).toBe("Task");
  const sfc = emitDefaultView(entity);
  expect(sfc).toContain('import { createTask, type Task } from "./task.ts";');
  expect(sfc).toContain('v-for="(item, i) in rows"');
  expect(sfc).toContain('<Checkbox v-model="item.done" label="done" />');
});

test("a select field renders as a <select> with options in the create form", () => {
  const ticket: VowNode = {
    ...entity,
    id: "vow_ticket",
    slug: "ticket",
    fields: [
      { name: "status", type: "select", required: false, options: ["todo", "doing", "done"] },
    ],
  };
  const sfc = emitDefaultView(ticket);
  expect(sfc).toContain('<select class="vow-view__input" v-model="draft.status"');
  expect(sfc).toContain('<option value="todo">todo</option>');
});

test("a date field renders as a native date input in the create form", () => {
  const event: VowNode = {
    ...entity,
    id: "vow_event",
    slug: "event",
    fields: [{ name: "starts", type: "date", required: true }],
  };
  const sfc = emitDefaultView(event);
  expect(sfc).toContain('<input class="vow-view__input" type="date" v-model="draft.starts"');
});

test("emitViewSfc fails fast when the target is not an emit view / entity", () => {
  expect(() => emitViewSfc(entity, entity)).toThrow();
  expect(() => emitViewSfc(view, view)).toThrow();
});
