import type { Component, ImportDecl, ReadonlyField, ReadonlyVow, UiNode } from "./types.ts";
import { groupedLines, sliceComputed } from "./slice.ts";
import { pascalCase, renderVueSfc } from "@vow/component";
import type { EntityLookup } from "./lookup.ts";
import { assertEmitEntity } from "./entity-guard.ts";

/** A reference cell labels its target by the target entity's first text field (else its id). */
function labelFieldOf(byId?: EntityLookup): (ref?: string) => string {
  return (ref?: string): string => {
    const target = byId?.get(ref ?? "");
    return target?.fields.find((field) => field.type === "text")?.name ?? "id";
  };
}

/** The opt-in row actions a `list:` enables. Default is read-only (the studio's stance); `delete` adds a
 *  trailing per-row delete button. Kept a struct so further actions (edit) can land without a signature churn. */
export interface ListActions {
  readonly delete: boolean;
}

/** The imports the list SFC needs — the store + entity type + the composed Table parts (+ Badge, + Button). */
function listImports(entity: ReadonlyVow, type: string, actions: ListActions): ImportDecl[] {
  const imports: ImportDecl[] = [
    { from: "vue", names: ["computed"] },
    { from: "@vow/store", names: ["useCollection"] },
    { from: `./${entity.slug}.ts`, names: [`type ${type}`] },
    { default: "Table", from: "./Table.vue" },
    { default: "TableRow", from: "./TableRow.vue" },
    { default: "TableHead", from: "./TableHead.vue" },
    { default: "TableCell", from: "./TableCell.vue" },
  ];
  if (entity.fields.some((field) => field.type === "select")) {
    imports.push({ default: "Badge", from: "./Badge.vue" });
  }
  if (actions.delete) {
    imports.push({ default: "Button", from: "./Button.vue" });
  }
  return imports;
}

/** What the list destructures off `useCollection` — `removeById` joins only when the delete action is on. */
function storeBinding(actions: ListActions): string {
  if (actions.delete) {
    return "{ items: rows, removeById }";
  }
  return "{ items: rows }";
}

/** A name-resolver pair per `reference` field — its option list + an id → display-name function. */
function referenceResolvers(entity: ReadonlyVow, label: (ref?: string) => string): string[] {
  const lines: string[] = [];
  for (const field of entity.fields.filter((candidate) => candidate.type === "reference")) {
    lines.push(
      `const ${field.name}Options = useCollection<{ id: string } & Record<string, unknown>>(${JSON.stringify(field.ref ?? "")}).items;`,
      `const ${field.name}Name = (id: unknown): string => String(${field.name}Options.find((t) => t.id === id)?.${label(field.ref)} ?? id ?? "");`,
    );
  }
  return lines;
}

/** The setup lines — the shared store, the slice/group computeds, and a name resolver per reference. When
 *  delete is enabled it also pulls `removeById` from the store: the list loops over filtered/sorted/grouped
 *  items, so the row's `id` (never its displayed index) drives the delete (the board's `update(id)` precedent). */
function listSetup(
  entity: ReadonlyVow,
  label: (ref?: string) => string,
  actions: ListActions,
): string[] {
  const type = pascalCase(entity.slug);
  return [
    `const ${storeBinding(actions)} = useCollection<${type}>(${JSON.stringify(entity.slug)});`,
    ...sliceComputed(type, "displayed"),
    ...groupedLines(type, "displayed"),
    ...referenceResolvers(entity, label),
  ];
}

/**
 * One display cell per field: boolean → Yes/No; reference → the target's resolved name (not its id);
 * select → a `<Badge>` status chip; everything else → the value.
 */
function cellContent(field: ReadonlyField): UiNode {
  if (field.type === "boolean") {
    return { expr: `item.${field.name} ? "Yes" : "No"`, kind: "interp" };
  }
  if (field.type === "reference") {
    return { expr: `${field.name}Name(item.${field.name})`, kind: "interp" };
  }
  if (field.type === "select") {
    return {
      attrs: [{ expr: `String(item.${field.name})`, kind: "bound", name: "label" }],
      children: [],
      kind: "component",
      name: "Badge",
    };
  }
  return { expr: `item.${field.name}`, kind: "interp" };
}

/** A `<TableHead>` labelled `field.name`, scoped to its column. */
function headCell(name: string): UiNode {
  return {
    attrs: [{ kind: "static", name: "scope", value: "col" }],
    children: [{ kind: "text", text: name }],
    kind: "component",
    name: "TableHead",
  };
}

/** The header cells — one per field, plus a trailing empty cell over the delete column when enabled. */
function headCells(entity: ReadonlyVow, actions: ListActions): UiNode[] {
  const cells = entity.fields.map((field) => headCell(field.name));
  if (actions.delete) {
    cells.push({
      attrs: [{ kind: "static", name: "scope", value: "col" }],
      children: [{ kind: "text", text: "Actions" }],
      kind: "component",
      name: "TableHead",
    });
  }
  return cells;
}

/** The `<thead>` — one `<TableHead>` per field (+ an Actions column when delete is enabled). */
function tableHead(entity: ReadonlyVow, actions: ListActions): UiNode {
  return {
    attrs: [],
    children: [
      {
        attrs: [],
        children: headCells(entity, actions),
        kind: "component",
        name: "TableRow",
      },
    ],
    kind: "element",
    tag: "thead",
  };
}

/** The column count the group header spans — one per header cell (a field, plus the delete column when on). */
function columnSpan(entity: ReadonlyVow, actions: ListActions): number {
  return headCells(entity, actions).length;
}

/** A group-header row (only when grouped) spanning every column. */
function groupHeaderRow(entity: ReadonlyVow, actions: ListActions): UiNode {
  return {
    attrs: [{ expr: "grp.key !== null", kind: "cond", type: "if" }],
    children: [
      {
        attrs: [
          { kind: "static", name: "colspan", value: String(columnSpan(entity, actions)) },
          { kind: "static", name: "class", value: "vow-table__group" },
        ],
        children: [{ expr: "grp.key", kind: "interp" }],
        kind: "component",
        name: "TableCell",
      },
    ],
    kind: "component",
    name: "TableRow",
  };
}

/** The trailing delete cell — a Button (a trash icon, a per-row `aria-label`) wired to `removeById(item.id)`.
 *  Delete BY ID, never the loop index: the rows are filtered/sorted/grouped, so the index would be wrong. */
function deleteCell(entity: ReadonlyVow): UiNode {
  return {
    attrs: [{ kind: "static", name: "class", value: "vow-view__delete" }],
    children: [
      {
        attrs: [
          { expr: `\`Delete this ${entity.slug}\``, kind: "bound", name: "aria-label" },
          { kind: "static", name: "icon", value: "trash" },
          { kind: "static", name: "variant", value: "ghost" },
          { expr: "removeById(item.id)", kind: "event", name: "click" },
        ],
        children: [],
        kind: "component",
        name: "Button",
      },
    ],
    kind: "component",
    name: "TableCell",
  };
}

/** A data row's field cells — one `<TableCell>` per field, plus the trailing delete cell when enabled. */
function rowCells(entity: ReadonlyVow, actions: ListActions): UiNode[] {
  const cells = entity.fields.map(
    (field): UiNode => ({
      attrs: [{ kind: "static", name: "class", value: `field-${field.name}` }],
      children: [cellContent(field)],
      kind: "component",
      name: "TableCell",
    }),
  );
  if (actions.delete) {
    cells.push(deleteCell(entity));
  }
  return cells;
}

/** A data row — one `<TableCell>` per field (+ the delete cell when enabled), rendering each field's cell. */
function dataRow(entity: ReadonlyVow, actions: ListActions): UiNode {
  return {
    attrs: [],
    children: rowCells(entity, actions),
    for: { as: "item", each: "grp.items", key: "item.id" },
    kind: "component",
    name: "TableRow",
  };
}

/** The `<tbody>` — group-header + data rows, looped per group. */
function tableBody(entity: ReadonlyVow, actions: ListActions): UiNode {
  return {
    attrs: [],
    children: [groupHeaderRow(entity, actions), dataRow(entity, actions)],
    for: { as: "grp", each: "grouped", key: "grp.key ?? '_'" },
    kind: "element",
    tag: "tbody",
  };
}

/** The whole list view — the Table when there are rows, else a friendly empty state. */
function listView(entity: ReadonlyVow, actions: ListActions): UiNode {
  return {
    attrs: [{ kind: "static", name: "class", value: `vow-view vow-view--${entity.slug}` }],
    children: [
      {
        attrs: [{ expr: "rows.length > 0", kind: "cond", type: "if" }],
        children: [tableHead(entity, actions), tableBody(entity, actions)],
        kind: "component",
        name: "Table",
      },
      {
        attrs: [
          { kind: "static", name: "class", value: "vow-empty" },
          { expr: "rows.length === 0", kind: "cond", type: "if" },
        ],
        children: [{ kind: "text", text: "Nothing here yet." }],
        kind: "element",
        tag: "p",
      },
    ],
    kind: "element",
    tag: "section",
  };
}

/** The default actions — read-only (the studio's stance); a `list: { of, actions: [delete] }` opts in. */
const READ_ONLY: ListActions = { delete: false };

/**
 * The list of an entity — what a `## view` pulls in via `list: <entity>`. Emitted on demand (because a
 * view references it), never automatically. Read-only by default — the studio's stance, the agent mutates
 * via the MCP — unless the referencing view opts a row action in (`list: { of, actions: [delete] }`), which
 * adds a trailing per-row delete button wired to the store by item id. Any heading is the referencing view's
 * job. `actions` is honoured here only; the `list:` view node renders the same `<Component>` either way.
 */
export function emitEntityList(
  entity: ReadonlyVow,
  byId?: EntityLookup,
  actions: ListActions = READ_ONLY,
): string {
  assertEmitEntity(entity, "list");
  const type = pascalCase(entity.slug);
  const label = labelFieldOf(byId);
  const component: Component = {
    doc: [
      `Generated from vow "${entity.slug}" (the list view of an entity). The vow is the source — do not edit.`,
    ],
    imports: listImports(entity, type, actions),
    name: type,
    setup: listSetup(entity, label, actions),
    view: listView(entity, actions),
  };
  return renderVueSfc(component);
}
