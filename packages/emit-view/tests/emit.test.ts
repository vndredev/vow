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
import { expect, test } from "vite-plus/test";
import type { Vow as VowNode } from "@vow/core";

/** Assert every substring is present in the generated SFC — keeps a test body to a few statements. */
function expectContains(sfc: string, parts: readonly string[]): void {
  for (const part of parts) {
    expect(sfc).toContain(part);
  }
}

/** Assert none of the substrings is present in the SFC. */
function expectMissing(sfc: string, parts: readonly string[]): void {
  for (const part of parts) {
    expect(sfc).not.toContain(part);
  }
}

/** The `$` of an interpolation, kept out of the adjacent `{` so no bare `${` literal trips a lint rule. */
const DOLLAR = "$";

/** A `${expr}` interpolation token assembled around `DOLLAR` — a bare literal trips no-template-curly-in-string. */
function interp(expr: string): string {
  return `${DOLLAR}{${expr}}`;
}

const entity: VowNode = {
  children: [],
  fields: [
    { name: "title", required: true, type: "text" },
    { name: "done", required: false, type: "boolean" },
  ],
  fulfills: { as: "entity", kind: "emit" },
  id: "vow_task",
  intent: "A task",
  proof: [],
  slug: "task",
};

const issue: VowNode = {
  ...entity,
  fields: [{ name: "assignee", ref: "user", required: false, type: "reference" }],
  id: "vow_issue",
  slug: "issue",
};

test("emitEntityList renders an unstyled, read-only table over the entity", () => {
  expect(viewComponentName(entity)).toBe("Task");
  const sfc = emitEntityList(entity);
  // Composes the Table primitive: a header from the field names, one <TableRow> per record (grouped).
  // Each value sits in its own <TableCell>; a boolean cell is read-only (Yes/No), not an input.
  expectContains(sfc, [
    'import { type Task } from "./task.ts";',
    'import { useCollection } from "@vow/store";',
    'const { items: rows } = useCollection<Task>("task");',
    'import Table from "./Table.vue";',
    '<TableHead scope="col">title</TableHead>',
    'v-for="grp in grouped"',
    'v-for="item in grp.items"',
    '<TableCell class="field-title">{{ item.title }}</TableCell>',
    '{{ item.done ? "Yes" : "No" }}',
  ]);
  expect(sfc).not.toContain("<style");
});

test("the read-only list has no create form and no delete — the agent mutates via the MCP", () => {
  const sfc = emitEntityList(entity);
  // No inline create form, no delete, no editable draft, nothing submits, no zod — a read-only view.
  expectMissing(sfc, [
    "vow-view__create",
    "vow-view__delete",
    "draft",
    "@submit",
    "createTask",
    'from "zod"',
  ]);
});

test("the list carries no heading of its own — the referencing view owns headings", () => {
  const sfc = emitEntityList(entity);
  expectMissing(sfc, ["vow-view__title", "<h1"]);
});

test("the opt-in delete action adds a per-row delete button wired to the store by id", () => {
  const sfc = emitEntityList(entity, new Map(), { delete: true });
  expectContains(sfc, [
    // The store binding now also pulls removeById; the trailing Actions column + a per-row delete Button.
    'const { items: rows, removeById } = useCollection<Task>("task");',
    'import Button from "./Button.vue";',
    "vow-view__delete",
    'icon="trash"',
    // Delete BY ID (item.id), never the displayed loop index of a filtered/sorted/grouped list.
    '@click="removeById(item.id)"',
    ':aria-label="`Delete this task`"',
  ]);
});

test("a delete list spans the extra Actions column in its group header (colspan = fields + 1)", () => {
  // Two fields + the delete column → colspan 3, so a grouped section still spans the full table width.
  const sfc = emitEntityList(entity, new Map(), { delete: true });
  expect(sfc).toContain('colspan="3"');
});

test("the default list stays read-only — no delete button, no removeById, no Button import", () => {
  const sfc = emitEntityList(entity);
  expectMissing(sfc, ["removeById", 'import Button from "./Button.vue";', 'icon="trash"']);
  expect(sfc).toContain('const { items: rows } = useCollection<Task>("task");');
});

test("a select field renders read-only as a Badge cell", () => {
  const ticket: VowNode = {
    ...entity,
    fields: [
      { name: "status", options: ["todo", "doing", "done"], required: false, type: "select" },
    ],
    id: "vow_ticket",
    slug: "ticket",
  };
  const sfc = emitEntityList(ticket);
  expectContains(sfc, [
    'import Badge from "./Badge.vue";',
    '<Badge :label="String(item.status)" />',
  ]);
  // No form control in a read-only list.
  expect(sfc).not.toContain("./Select.vue");
});

test("fieldControl renders the right input per field type (the form control map)", () => {
  // A native date input.
  const date = JSON.stringify(
    fieldControl({ name: "starts", required: true, type: "date" }, "draft.starts"),
  );
  expect(date).toContain('"value":"date"');
  const longtext = JSON.stringify(
    fieldControl({ name: "body", required: false, type: "longtext" }, "draft.body"),
  );
  expect(longtext).toContain('"tag":"textarea"');
  const select = JSON.stringify(
    fieldControl(
      { name: "status", options: ["a"], required: false, type: "select" },
      "draft.status",
    ),
  );
  expect(select).toContain('"name":"Select"');
  // A reference reads the target's <field>Choices computed.
  const reference = JSON.stringify(
    fieldControl(
      { name: "assignee", ref: "user", required: false, type: "reference" },
      "draft.assignee",
    ),
  );
  expect(reference).toContain("assigneeChoices");
});

test("a reference cell resolves the stored id to the target's display name (not the id)", () => {
  // No byId → the label falls back to the id; a read-only list has no form dropdown.
  const sfc = emitEntityList(issue);
  expectContains(sfc, [
    'const assigneeOptions = useCollection<{ id: string } & Record<string, unknown>>("user").items;',
    'const assigneeName = (id: unknown): string => assigneeById.value.get(String(id)) ?? String(id ?? "");',
    "{{ assigneeName(item.assignee) }}",
  ]);
  expect(sfc).not.toContain("assigneeChoices");
});

test("a reference cell memoizes an id index instead of a per-row .find() scan", () => {
  // O(N+M): the index recomputes only when the referenced collection changes, not per row per render.
  // A truthy-only filter preserves the raw-id fallback when a target's label is null/empty.
  const sfc = emitEntityList(issue);
  expectContains(sfc, [
    "const assigneeById = computed(() => new Map(assigneeOptions.filter((t) => t.id).map((t) => [String(t.id), String(t.id)])));",
  ]);
  expect(sfc).not.toContain("assigneeOptions.find((t) => t.id === id)");
});

test("a reference cell labels its target by the target's first text field", () => {
  const user: VowNode = {
    ...entity,
    fields: [{ name: "name", required: true, type: "text" }],
    id: "vow_user",
    slug: "user",
  };
  const sfc = emitEntityList(issue, new Map([["user", user]]));
  // The memoized index reads the target's `name`.
  expect(sfc).toContain(
    "assigneeOptions.filter((t) => t.name).map((t) => [String(t.id), String(t.name)])",
  );
});

test("emitEntityStats counts rows per a select field, composing Stats/Stat", () => {
  const ticket: VowNode = {
    ...entity,
    fields: [
      { name: "status", options: ["todo", "doing", "done"], required: false, type: "select" },
    ],
    id: "vow_ticket",
    slug: "ticket",
  };
  expect(statsComponentName("ticket", "status")).toBe("TicketStatusStats");
  const sfc = emitEntityStats(ticket, "status");
  expectContains(sfc, [
    'const { items: rows } = useCollection<Ticket>("ticket");',
    'const options = ["todo","doing","done"];',
    "rows.filter((r) => r.status === o).length",
    '<Stat :value="s.value" :label="s.label"',
  ]);
  // `by` must be a select field of the entity.
  expect(() => emitEntityStats(ticket, "title")).toThrow();
});

test("emitEntityCards renders a Card per record, titled by the first text field", () => {
  const ticket: VowNode = {
    ...entity,
    fields: [
      { name: "title", required: true, type: "text" },
      { name: "status", options: ["todo", "done"], required: false, type: "select" },
    ],
    id: "vow_ticket",
    slug: "ticket",
  };
  expect(cardsComponentName("ticket")).toBe("TicketCards");
  const sfc = emitEntityCards(ticket);
  // Group-by: a section per group (one when ungrouped); a non-title field is labelled in the body.
  expectContains(sfc, [
    'const { items: rows } = useCollection<Ticket>("ticket");',
    'import Card from "./Card.vue";',
    'v-for="grp in grouped"',
    'v-for="item in grp.items"',
    "<CardHeader>{{ item.title }}</CardHeader>",
    "status: ",
  ]);
  const notEntity: VowNode = { ...ticket, fulfills: { as: "view", kind: "emit" } };
  expect(() => emitEntityCards(notEntity)).toThrow();
});

test("emitEntityBoard renders a column per option, draggable cards, a status writeback", () => {
  const ticket: VowNode = {
    ...entity,
    fields: [
      { name: "title", required: true, type: "text" },
      { name: "status", options: ["todo", "done"], required: false, type: "select" },
    ],
    id: "vow_ticket",
    slug: "ticket",
  };
  expect(boardComponentName("ticket", "status")).toBe("TicketStatusBoard");
  const sfc = emitEntityBoard(ticket, "status");
  // A drop writes the field back through the store's `update` (a survive-the-poll PATCH, not a bare mutation).
  expectContains(sfc, [
    'const options = ["todo","done"];',
    'v-for="col in columns"',
    'draggable="true"',
    "@dragover.prevent",
    '@dragstart="dragged = item"',
    '@drop="onDrop(col.option)"',
    'const { items: rows, update } = useCollection<Ticket>("ticket");',
    'update(dragged.value.id, { ["status"]: option });',
    "defineProps<{ filter?: Record<string, unknown>; sort?: keyof Ticket; group?: keyof Ticket }>",
    "const visible = computed(()",
    "visible.value.filter((r) => r.status === o)",
  ]);
  // The bare reactive mutation is gone (it never reached the DB; the next poll reverted it).
  expectMissing(sfc, ['dragged.value.status = option as Ticket["status"]']);
  // `by` must be a select field.
  expect(() => emitEntityBoard(ticket, "title")).toThrow();
});

// The SFC carries exactly one legitimate `</script` — its own closing tag (a breakout would add a second).
const SOLE_SCRIPT_CLOSE = 1;

test("a select option can never break out of the generated <script setup> (stored XSS)", () => {
  // A `</script>` in an option (reachable via MCP add_field / hand-authored vow.md) must not close the
  // SFC's script block early. The emitter neutralizes every `</` to `<\/` (an inert JS string).
  const breakout = "done</script><svg onload=alert(1)>";
  const ticket: VowNode = {
    ...entity,
    fields: [{ name: "status", options: ["todo", breakout], required: false, type: "select" }],
    id: "vow_ticket",
    slug: "ticket",
  };
  const board = emitEntityBoard(ticket, "status");
  const stats = emitEntityStats(ticket, "status");
  for (const sfc of [board, stats]) {
    // The raw breakout is escaped in the embed; the setup line carries the inert `<\/script>` form.
    expect(sfc).toContain(String.raw`done<\/script><svg onload=alert(1)>`);
    // Only the SFC's own close tag survives — no premature one from the option.
    expect((sfc.match(/<\/script/gu) ?? []).length).toBe(SOLE_SCRIPT_CLOSE);
  }
});

test("emitEntityBoard gives each card a keyboard move path (WCAG 2.1.1), not drag-only", () => {
  const ticket: VowNode = {
    ...entity,
    fields: [
      { name: "title", required: true, type: "text" },
      { name: "status", options: ["todo", "done"], required: false, type: "select" },
    ],
    id: "vow_ticket",
    slug: "ticket",
  };
  const sfc = emitEntityBoard(ticket, "status");
  // The card is focusable + labelled, and the arrow keys move it to the adjacent column — the same
  // `update(id, { [by]: option })` mutation the pointer drag performs, with no pointer required.
  expectContains(sfc, [
    'tabindex="0"',
    'role="group"',
    `:aria-label="\`status: ${interp("item.status")}. Use the left and right arrows to move.\`"`,
    '@keydown.left="moveCard(item, -1)"',
    '@keydown.right="moveCard(item, 1)"',
    "function move(card: Ticket, delta: number): void {",
    "const option = options[options.indexOf(card.status as string) + delta];",
    "if (option === undefined) return;",
    'update(card.id, { ["status"]: option });',
    `announce.value = \`Moved to ${interp("option")}\`;`,
  ]);
  // The move is announced to assistive tech through a polite live region.
  expectContains(sfc, ['role="status"', 'aria-live="polite"', "{{ announce }}"]);
});

test("emitEntityBoard restores focus after a keyboard move so it is not single-use (WCAG 2.4.3)", () => {
  const ticket: VowNode = {
    ...entity,
    fields: [
      { name: "title", required: true, type: "text" },
      { name: "status", options: ["todo", "done"], required: false, type: "select" },
    ],
    id: "vow_ticket",
    slug: "ticket",
  };
  const sfc = emitEntityBoard(ticket, "status");
  // The move re-renders the card into another column's v-for (unmounting the focused element), so the
  // Handler awaits the next tick and refocuses the card by its stable id; without it the move dropped
  // Focus to <body> and was usable exactly once.
  expectContains(sfc, [
    ':data-card-id="item.id"',
    "async function moveCard(card: Ticket, delta: number): Promise<void> {",
    "move(card, delta);",
    "await nextTick();",
    `document.querySelector<HTMLElement>(\`[data-card-id="${interp("card.id")}"]\`)?.focus();`,
  ]);
  // `nextTick` is imported (the DOM must settle before the re-mounted card exists to focus).
  expect(sfc).toContain('import { computed, nextTick, ref } from "vue";');
});

test("emitEntityList fails fast when the target is not an emit entity", () => {
  const view: VowNode = {
    children: [],
    fields: [],
    fulfills: { as: "view", kind: "emit" },
    id: "vow_page",
    intent: "A page",
    proof: [],
    slug: "page",
  };
  expect(() => emitEntityList(view)).toThrow();
});

test("emitEntityList rejects a zero-field entity (needs >=1 field to render)", () => {
  const empty: VowNode = { ...entity, fields: [], id: "vow_empty", slug: "empty" };
  expect(() => emitEntityList(empty)).toThrow(/needs >=1 field/u);
});
