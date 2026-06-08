import { expect, test } from "vite-plus/test";
import { type Vow as VowNode } from "@vow/core";
import {
  boardComponentName,
  cardsComponentName,
  emitEntityBoard,
  emitEntityCards,
  emitEntityList,
  emitEntityStats,
  fieldControl,
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

test("emitEntityList renders an unstyled, read-only table over the entity", () => {
  expect(viewComponentName(entity)).toBe("Task");
  const sfc = emitEntityList(entity);
  expect(sfc).toContain('import { type Task } from "./task.ts";');
  expect(sfc).toContain('import { useCollection } from "@vow/store";');
  expect(sfc).toContain('const { items: rows } = useCollection<Task>("task");');
  // composes the Table primitive: a header from the field names, one <TableRow> per record (grouped —
  // one <tbody> when ungrouped), each value in its own <TableCell>
  expect(sfc).toContain('import Table from "./Table.vue";');
  expect(sfc).toContain('<TableHead scope="col">title</TableHead>');
  expect(sfc).toContain('v-for="grp in grouped"');
  expect(sfc).toContain('v-for="item in grp.items"');
  expect(sfc).toContain('<TableCell class="field-title">{{ item.title }}</TableCell>');
  expect(sfc).toContain('{{ item.done ? "Yes" : "No" }}'); // boolean: read-only, not a checkbox
  expect(sfc).not.toContain("<style");
});

test("the read-only list has no create form and no delete — the agent mutates via the MCP", () => {
  const sfc = emitEntityList(entity);
  expect(sfc).not.toContain("vow-view__create"); // no inline create form
  expect(sfc).not.toContain("vow-view__delete"); // no delete button
  expect(sfc).not.toContain("draft"); // no editable draft
  expect(sfc).not.toContain("@submit"); // nothing submits
  expect(sfc).not.toContain("createTask"); // the list never creates
  expect(sfc).not.toContain('from "zod"'); // no validation in a read-only view
});

test("the list carries no heading of its own — the referencing view owns headings", () => {
  const sfc = emitEntityList(entity);
  expect(sfc).not.toContain("vow-view__title");
  expect(sfc).not.toContain("<h1");
});

test("a select field renders read-only as a Badge cell", () => {
  const ticket: VowNode = {
    ...entity,
    id: "vow_ticket",
    slug: "ticket",
    fields: [
      { name: "status", type: "select", required: false, options: ["todo", "doing", "done"] },
    ],
  };
  const sfc = emitEntityList(ticket);
  expect(sfc).toContain('import Badge from "./Badge.vue";');
  expect(sfc).toContain('<Badge :label="String(item.status)" />');
  expect(sfc).not.toContain("./Select.vue"); // no form control in a read-only list
});

test("fieldControl renders the right input per field type (the form control map)", () => {
  const date = JSON.stringify(
    fieldControl({ name: "starts", type: "date", required: true }, "draft.starts"),
  );
  expect(date).toContain('"value":"date"'); // a native date input
  const longtext = JSON.stringify(
    fieldControl({ name: "body", type: "longtext", required: false }, "draft.body"),
  );
  expect(longtext).toContain('"tag":"textarea"');
  const select = JSON.stringify(
    fieldControl(
      { name: "status", type: "select", required: false, options: ["a"] },
      "draft.status",
    ),
  );
  expect(select).toContain('"name":"Select"');
  const reference = JSON.stringify(
    fieldControl(
      { name: "assignee", type: "reference", required: false, ref: "user" },
      "draft.assignee",
    ),
  );
  expect(reference).toContain("assigneeChoices"); // reads the target's <field>Choices computed
});

const issue: VowNode = {
  ...entity,
  id: "vow_issue",
  slug: "issue",
  fields: [{ name: "assignee", type: "reference", required: false, ref: "user" }],
};

test("a reference cell resolves the stored id to the target's display name (not the id)", () => {
  const sfc = emitEntityList(issue); // no byId → label falls back to the id
  expect(sfc).toContain(
    'const assigneeOptions = useCollection<{ id: string } & Record<string, unknown>>("user").items;',
  );
  expect(sfc).toContain("const assigneeName = (id: unknown): string =>");
  expect(sfc).toContain("{{ assigneeName(item.assignee) }}"); // the resolved name in the cell
  expect(sfc).not.toContain("assigneeChoices"); // no form dropdown in a read-only list
});

test("a reference cell labels its target by the target's first text field", () => {
  const user: VowNode = {
    ...entity,
    id: "vow_user",
    slug: "user",
    fields: [{ name: "name", type: "text", required: true }],
  };
  const sfc = emitEntityList(issue, new Map([["user", user]]));
  expect(sfc).toContain("?.name ?? id"); // the resolver reads the target's `name`
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

test("emitEntityCards renders a Card per record, titled by the first text field", () => {
  const ticket: VowNode = {
    ...entity,
    id: "vow_ticket",
    slug: "ticket",
    fields: [
      { name: "title", type: "text", required: true },
      { name: "status", type: "select", required: false, options: ["todo", "done"] },
    ],
  };
  expect(cardsComponentName("ticket")).toBe("TicketCards");
  const sfc = emitEntityCards(ticket);
  expect(sfc).toContain('const { items: rows } = useCollection<Ticket>("ticket");');
  expect(sfc).toContain('import Card from "./Card.vue";');
  expect(sfc).toContain('v-for="grp in grouped"'); // group-by: a section per group (one when ungrouped)
  expect(sfc).toContain('v-for="item in grp.items"');
  expect(sfc).toContain("<CardHeader>{{ item.title }}</CardHeader>");
  expect(sfc).toContain("status: "); // a non-title field, labelled, in the body
  const notEntity: VowNode = { ...ticket, fulfills: { kind: "emit", as: "view" } };
  expect(() => emitEntityCards(notEntity)).toThrow();
});

test("emitEntityBoard renders a column per option, draggable cards, a status writeback", () => {
  const ticket: VowNode = {
    ...entity,
    id: "vow_ticket",
    slug: "ticket",
    fields: [
      { name: "title", type: "text", required: true },
      { name: "status", type: "select", required: false, options: ["todo", "done"] },
    ],
  };
  expect(boardComponentName("ticket", "status")).toBe("TicketStatusBoard");
  const sfc = emitEntityBoard(ticket, "status");
  expect(sfc).toContain('const options = ["todo","done"];');
  expect(sfc).toContain('v-for="col in columns"');
  expect(sfc).toContain('draggable="true"');
  expect(sfc).toContain("@dragover.prevent");
  expect(sfc).toContain('@dragstart="dragged = item"');
  expect(sfc).toContain('@drop="onDrop(col.option)"'); // a drop writes the field back
  expect(sfc).toContain('dragged.value.status = option as Ticket["status"]');
  // slicing: a `filter` / `sort` prop narrows + orders the visible cards before they're grouped
  expect(sfc).toContain(
    "defineProps<{ filter?: Record<string, unknown>; sort?: keyof Ticket; group?: keyof Ticket }>",
  );
  expect(sfc).toContain("const visible = computed(()");
  expect(sfc).toContain("visible.value.filter((r) => r.status === o)");
  expect(() => emitEntityBoard(ticket, "title")).toThrow(); // `by` must be a select field
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
