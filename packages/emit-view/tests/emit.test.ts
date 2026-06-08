import { expect, test } from "vite-plus/test";
import { type Vow as VowNode } from "@vow/core";
import {
  emitEntityList,
  emitEntityStats,
  statsComponentName,
  viewComponentName,
} from "../src/index.ts";

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

test("emitEntityList renders an unstyled, hooked CRUD table over the entity", () => {
  expect(viewComponentName(entity)).toBe("Task");
  const sfc = emitEntityList(entity);
  expect(sfc).toContain('import { createTask, type Task } from "./task.ts";');
  expect(sfc).toContain('import { useCollection } from "@vow/store";');
  expect(sfc).toContain('import Checkbox from "./Checkbox.vue";');
  expect(sfc).toContain('const { items: rows, append, removeAt } = useCollection<Task>("task");');
  // composes the Table primitive (a composition, not a primitive): a header from the field names,
  // one <TableRow> per record, each value in its own <TableCell>
  expect(sfc).toContain('import Table from "./Table.vue";');
  expect(sfc).toContain('<TableHead scope="col">title</TableHead>');
  expect(sfc).toContain('v-for="(item, i) in rows"');
  expect(sfc).toContain('<TableCell class="field-title">{{ item.title }}</TableCell>');
  expect(sfc).toContain('<Checkbox v-model="item.done" label="done" />');
  expect(sfc).toContain('v-model="draft.title"');
  expect(sfc).toContain('@submit.prevent="add"');
  expect(sfc).toContain("createTask(draft.value)");
  expect(sfc).toContain('@click="remove(i)"');
  expect(sfc).not.toContain("<style");
});

test("the create form is a validated <Field> stack (converged with the ## form treatment)", () => {
  const sfc = emitEntityList(entity);
  expect(sfc).toContain('import Field from "./Field.vue";');
  expect(sfc).toContain('import { ZodError } from "zod";');
  expect(sfc).toContain('<form class="vow-form vow-view__create"'); // a stacked form, not a flex row
  expect(sfc).toContain('<Field label="title" :control-id="titleId" :error="errors.title">');
  expect(sfc).toContain("err instanceof ZodError"); // per-field errors, no silent swallow
});

test("the list carries no heading of its own — the referencing view owns headings", () => {
  const sfc = emitEntityList(entity);
  expect(sfc).not.toContain("vow-view__title");
  expect(sfc).not.toContain("<h1");
});

test("a select field renders via the Select primitive with its options", () => {
  const ticket: VowNode = {
    ...entity,
    id: "vow_ticket",
    slug: "ticket",
    fields: [
      { name: "status", type: "select", required: false, options: ["todo", "doing", "done"] },
    ],
  };
  const sfc = emitEntityList(ticket);
  expect(sfc).toContain('import Select from "./Select.vue";');
  expect(sfc).toContain('<Select v-model="draft.status"');
  expect(sfc).toContain("{ value: 'todo', label: 'todo' }");
});

test("a date field renders as a native date input in the create form", () => {
  const event: VowNode = {
    ...entity,
    id: "vow_event",
    slug: "event",
    fields: [{ name: "starts", type: "date", required: true }],
  };
  const sfc = emitEntityList(event);
  expect(sfc).toContain('<input class="vow-input" type="date" v-model="draft.starts"');
});

test("a longtext field renders as a textarea (the shared fieldControl)", () => {
  const note: VowNode = {
    ...entity,
    id: "vow_note",
    slug: "note",
    fields: [{ name: "body", type: "longtext", required: false }],
  };
  const sfc = emitEntityList(note);
  expect(sfc).toContain('<textarea class="vow-input vow-textarea" v-model="draft.body"');
});

const issue: VowNode = {
  ...entity,
  id: "vow_issue",
  slug: "issue",
  fields: [{ name: "assignee", type: "reference", required: false, ref: "user" }],
};

test("a reference field renders the Select primitive over the target's shared collection", () => {
  const sfc = emitEntityList(issue); // no byId → label falls back to the id
  expect(sfc).toContain(
    'const assigneeOptions = useCollection<{ id: string } & Record<string, unknown>>("user").items;',
  );
  expect(sfc).toContain("const assigneeChoices = computed(() =>");
  expect(sfc).toContain("value: t.id, label: String(t.id)");
  expect(sfc).toContain('<Select v-model="draft.assignee"');
  expect(sfc).toContain(':options="assigneeChoices"');
});

test("a reference dropdown labels items by the target's first text field", () => {
  const user: VowNode = {
    ...entity,
    id: "vow_user",
    slug: "user",
    fields: [{ name: "name", type: "text", required: true }],
  };
  const sfc = emitEntityList(issue, new Map([["user", user]]));
  expect(sfc).toContain("label: String(t.name)");
});

test("emitEntityStats counts rows per a select field, composing Stats/Stat", () => {
  const ticket: VowNode = {
    ...entity,
    id: "vow_ticket",
    slug: "ticket",
    fields: [
      { name: "status", type: "select", required: false, options: ["todo", "doing", "done"] },
    ],
  };
  expect(statsComponentName("ticket", "status")).toBe("TicketStatusStats");
  const sfc = emitEntityStats(ticket, "status");
  expect(sfc).toContain('const { items: rows } = useCollection<Ticket>("ticket");');
  expect(sfc).toContain('const options = ["todo","doing","done"];');
  expect(sfc).toContain("rows.filter((r) => r.status === o).length");
  expect(sfc).toContain('<Stat :value="s.value" :label="s.label"');
  expect(() => emitEntityStats(ticket, "title")).toThrow(); // `by` must be a select field of the entity
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
