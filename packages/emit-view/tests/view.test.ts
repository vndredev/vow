import {
  VIEW_NODE_TYPES,
  emitAppLayout,
  emitAppRoutes,
  emitForm,
  emitView,
  knownViewType,
  referencedPrimitives,
} from "../src/index.ts";
import { expect, test } from "vite-plus/test";
import type { Vow } from "@vow/core";

/** Build a view-only vow (a `## view`) with a given component list. */
const view = (nodes: Vow["view"]): Vow => ({
  children: [],
  fields: [],
  fulfills: { as: "view", kind: "emit" },
  id: "vow_v",
  intent: "A page",
  proof: [],
  slug: "page",
  view: nodes,
});

/** Assert every substring is present in the generated code — keeps a test body to a few statements. */
function expectContains(code: string, parts: readonly string[]): void {
  for (const part of parts) {
    expect(code).toContain(part);
  }
}

const taskEntity: Vow = {
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

const addTaskForm: Vow = {
  children: [],
  fields: [],
  form: { of: "task", submit: "Add task" },
  fulfills: { as: "form", kind: "emit" },
  id: "vow_addtask",
  intent: "Add a task",
  proof: [],
  slug: "add-task",
};

test("hero expands to a column Flex with eyebrow, title and lead", () => {
  const sfc = emitView(
    view([{ type: "hero", value: { eyebrow: "vow", lead: "Build it", title: "The framework" } }]),
  );
  expectContains(sfc, [
    '<Flex :direction="\'column\'" :gap="3">',
    '<span class="vow-eyebrow">vow</span>',
    "<h1>The framework</h1>",
    "<p>Build it</p>",
    'import Flex from "./Flex.vue";',
  ]);
});

test("features expand to a 3-column Grid of Cards", () => {
  const sfc = emitView(
    view([
      {
        type: "features",
        value: [
          { body: "aa", title: "A" },
          { body: "bb", title: "B" },
        ],
      },
    ]),
  );
  expectContains(sfc, [
    '<Grid :columns="3" :gap="4">',
    "<Card>",
    "<CardHeader>A</CardHeader>",
    "<CardBody>aa</CardBody>",
  ]);
});

test("list references a generated view by entity slug and imports it", () => {
  const sfc = emitView(view([{ type: "list", value: "task" }]), ["task"]);
  expectContains(sfc, ["<Task />", 'import Task from "./Task.vue";']);
});

test("list with an unknown entity throws", () => {
  expect(() => emitView(view([{ type: "list", value: "ghost" }]), ["task"])).toThrow(
    /unknown entity/u,
  );
});

test("primitives are the escape hatch: flex with props + children", () => {
  const sfc = emitView(
    view([{ type: "flex", value: { children: [{ text: "hi" }], direction: "column", gap: 4 } }]),
  );
  expect(sfc).toContain('<Flex :direction="\'column\'" :gap="4">hi</Flex>');
});

test("a primitive placed directly in a view renders as its component + imports its adapter", () => {
  const sfc = emitView(view([{ type: "button", value: { label: "Save", variant: "outline" } }]));
  expectContains(sfc, [
    'import Button from "./Button.vue";',
    `<Button :label="'Save'" :variant="'outline'" />`,
  ]);
});

test("the reserved model: key on a view primitive becomes a v-model", () => {
  const sfc = emitView(
    view([{ type: "checkbox", value: { label: "Subscribe", model: "subscribed" } }]),
  );
  expectContains(sfc, ['import Checkbox from "./Checkbox.vue";', 'v-model="subscribed"']);
});

test("referencedPrimitives lists the primitives a view places directly (the closed registry)", () => {
  const vow = view([
    { type: "button", value: { label: "Go" } },
    { type: "text", value: "hi" },
  ]);
  expect(referencedPrimitives(vow)).toEqual(["Button"]);
});

test("an unknown component throws (the closed primitive/view vocabulary)", () => {
  expect(() => emitView(view([{ type: "nope", value: {} }]))).toThrow(/unknown view component/u);
});

test("knownViewType accepts a handler, a primitive, a text tag, and the bare text escape", () => {
  expect(knownViewType("hero")).toBe(true);
  expect(knownViewType("button")).toBe(true);
  expect(knownViewType("flex")).toBe(true);
  expect(knownViewType("h1")).toBe(true);
  expect(knownViewType("text")).toBe(true);
  expect(knownViewType("nope")).toBe(false);
});

test("every enumerated VIEW_NODE_TYPES entry is one knownViewType accepts — the list can't oversell", () => {
  for (const type of VIEW_NODE_TYPES) {
    expect(knownViewType(type), `${type} is enumerated but rejected`).toBe(true);
  }
});

test("the view is wrapped in a vow-app root", () => {
  expect(emitView(view([{ type: "text", value: "hello" }]))).toContain('<div class="vow-app">');
});

test("emitForm renders a labelled, zod-validated form bound to an entity", () => {
  const sfc = emitForm(addTaskForm, new Map([["task", taskEntity]]));
  // A boolean self-labels as a Checkbox; per-field errors come from the zod schema.
  expectContains(sfc, [
    'import { ZodError } from "zod";',
    'import { createTask, type Task } from "./task.ts";',
    '<form class="vow-form" @submit.prevent="submit">',
    '<Field label="title" :control-id="titleId" :error="errors.title">',
    '<Checkbox v-model="draft.done" label="done" />',
    "append(createTask(draft.value));",
    "err instanceof ZodError",
    '<Button type="submit" label="Add task" />',
  ]);
});

test("a Select field forwards the field id as control-id so the label points at the trigger", () => {
  const entity: Vow = {
    ...taskEntity,
    fields: [{ name: "status", options: ["todo", "done"], required: false, type: "select" }],
  };
  const sfc = emitForm(addTaskForm, new Map([["task", entity]]));
  // Both the Field's `for` and the Select's `control-id` are `statusId`: the once-dangling label-for now points at the real combobox trigger (click-to-focus + a programmatic label association). The Select also takes `described-by` + `invalid`, which it forwards as the trigger's aria-describedby + aria-invalid — so the rendered error is programmatically associated (parity with native fields).
  expectContains(sfc, [
    '<Field label="status" :control-id="statusId" :error="errors.status">',
    ':control-id="statusId"',
    `:described-by="statusId + '-error'"`,
    ':invalid="!!errors.status"',
    'import Select from "./Select.vue";',
  ]);
});

const configEntity: Vow = {
  children: [],
  fields: [{ name: "repo", required: true, type: "text" }],
  fulfills: { as: "entity", kind: "emit" },
  id: "vow_config",
  intent: "Connection settings",
  proof: [],
  slug: "config",
};

const settingsForm: Vow = {
  children: [],
  fields: [],
  form: { edit: true, of: "config", submit: "Save settings" },
  fulfills: { as: "form", kind: "emit" },
  id: "vow_settings",
  intent: "Edit the settings",
  proof: [],
  slug: "settings",
};

test("emitForm in edit mode pre-loads the singleton row and updates it in place", () => {
  const sfc = emitForm(settingsForm, new Map([["config", configEntity]]));
  // It loads the current row into the draft, updates (never appends) by id, keeps values, flashes "Saved".
  expectContains(sfc, [
    'import { ref, useId, computed, watch } from "vue";',
    'const { items, update } = useCollection<Config>("config");',
    "const saved = ref(false);",
    "const current = computed<Config | undefined>(() => items[0]);",
    "draft.value = { ...row };",
    "update(row.id, createConfig({ ...draft.value, id: row.id }));",
    "saved.value = true;",
    '<p class="vow-form__saved" role="status" v-if="saved">Saved</p>',
  ]);
  // The edit form does not append or blank the draft.
  expect(sfc).not.toContain("append(");
  expect(sfc).not.toContain("draft.value = {};");
});

test("emitForm fails fast when its `of` is not a known entity", () => {
  expect(() => emitForm(addTaskForm, new Map())).toThrow(/not a known entity/u);
});

test("every @vow/emit-view throw carries the single `emit-view:` source prefix", () => {
  // The prefix names the source package; emit-view publishes one prefix, never `emit-form:` or `vow:`.
  expect(() => emitForm(addTaskForm, new Map())).toThrow(/^emit-view:/u);
  expect(() => emitView(view([{ type: "issues", value: { as: "cards" } }]))).toThrow(
    /^emit-view:/u,
  );
});

test("a link: node renders an internal anchor the router intercepts", () => {
  const sfc = emitView(view([{ type: "link", value: { label: "Add a task", to: "/add-task" } }]));
  expect(sfc).toContain('<a class="vow-link" href="/add-task">Add a task</a>');
});

test("emitAppRoutes maps each non-root page to a /slug route loading its .vue", () => {
  const code = emitAppRoutes([{ slug: "add-task", title: "Add a task" }]);
  expectContains(code, [
    'import type { Route } from "@vow/router";',
    '{ path: "/add-task", load: () => import("./add-task.vue"), title: "Add a task" },',
  ]);
});

test("emitAppLayout wraps pages in the @vow/shell dashboard, passing pages + path + title", () => {
  const code = emitAppLayout([{ slug: "add-task", title: "Add a task" }], "Task planner");
  expectContains(code, [
    'import Shell from "@vow/shell/Shell.vue";',
    'import "@vow/shell/style.css";',
    'const pages = [{ path: "/add-task", title: "Add a task" }];',
    'const title = "Task planner";',
    '<Shell :pages="pages" :path="path" :title="title"><slot /></Shell>',
  ]);
});

test("emitAppLayout omits the title when none is given (the shell's own fallback applies)", () => {
  const code = emitAppLayout([{ slug: "users", title: "Team" }]);
  expect(code).not.toContain("const title");
  expect(code).toContain('<Shell :pages="pages" :path="path"><slot /></Shell>');
});

test("emitAppLayout serialises each page's nav config — icon, group, order (only when set)", () => {
  // The second page is bare — no extra keys emitted.
  const code = emitAppLayout(
    [
      { group: "Work", icon: "list-checks", order: 2, slug: "tasks", title: "Tasks" },
      { slug: "team", title: "Team" },
    ],
    "vow studio",
  );
  expectContains(code, [
    '{ path: "/tasks", title: "Tasks", icon: "list-checks", group: "Work", order: 2 }',
    '{ path: "/team", title: "Team" }',
  ]);
});

test("emitAppLayout passes the shell layout (nav · width · variant) only when declared", () => {
  const withShell = emitAppLayout([{ slug: "team", title: "Team" }], "vow studio", {
    nav: "header",
    variant: "cards",
    width: "full",
  });
  expectContains(withShell, [
    'const nav = "header";',
    'const width = "full";',
    'const variant = "cards";',
    ':nav="nav" :width="width" :variant="variant"',
  ]);
  const without = emitAppLayout([{ slug: "team", title: "Team" }], "vow studio");
  expect(without).not.toContain(":nav=");
});
