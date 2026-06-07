import { expect, test } from "vite-plus/test";
import { type Vow as VowNode } from "@vow/core";
import { emitEntityList, viewComponentName } from "../src/index.ts";

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

test("emitEntityList renders an unstyled, hooked CRUD list over the entity", () => {
  expect(viewComponentName(entity)).toBe("Task");
  const sfc = emitEntityList(entity);
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

test("the list carries no heading of its own — the referencing view owns headings", () => {
  const sfc = emitEntityList(entity);
  expect(sfc).not.toContain("vow-view__title");
  expect(sfc).not.toContain("<h1");
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
  const sfc = emitEntityList(ticket);
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
  const sfc = emitEntityList(event);
  expect(sfc).toContain('<input class="vow-view__input" type="date" v-model="draft.starts"');
});

test("a reference field renders as an id input hinting its target", () => {
  const issue: VowNode = {
    ...entity,
    id: "vow_issue",
    slug: "issue",
    fields: [{ name: "assignee", type: "reference", required: false, ref: "user" }],
  };
  const sfc = emitEntityList(issue);
  expect(sfc).toContain('v-model="draft.assignee"');
  expect(sfc).toContain('placeholder="assignee (user id)"');
});

test("emitEntityList fails fast when the target is not an emit entity", () => {
  const view: VowNode = {
    id: "vow_page",
    slug: "page",
    intent: "A page",
    children: [],
    fields: [],
    proof: [],
    fulfills: { kind: "emit", as: "view" },
  };
  expect(() => emitEntityList(view)).toThrow();
});
