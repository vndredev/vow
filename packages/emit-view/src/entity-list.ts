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

/** The imports the list SFC needs — the store + entity type + the composed Table parts (+ Badge). */
function listImports(entity: ReadonlyVow, type: string): ImportDecl[] {
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
  return imports;
}

/** The setup lines — the shared store, the slice/group computeds, and a name resolver per reference. */
function listSetup(entity: ReadonlyVow, type: string, label: (ref?: string) => string): string[] {
  const setup: string[] = [
    `const { items: rows } = useCollection<${type}>(${JSON.stringify(entity.slug)});`,
    ...sliceComputed(type, "displayed"),
    ...groupedLines(type, "displayed"),
  ];
  for (const field of entity.fields.filter((candidate) => candidate.type === "reference")) {
    setup.push(
      `const ${field.name}Options = useCollection<{ id: string } & Record<string, unknown>>(${JSON.stringify(field.ref ?? "")}).items;`,
      `const ${field.name}Name = (id: unknown): string => String(${field.name}Options.find((t) => t.id === id)?.${label(field.ref)} ?? id ?? "");`,
    );
  }
  return setup;
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

/** The `<thead>` — one `<TableHead>` per field. */
function tableHead(entity: ReadonlyVow): UiNode {
  return {
    attrs: [],
    children: [
      {
        attrs: [],
        children: entity.fields.map(
          (field): UiNode => ({
            attrs: [{ kind: "static", name: "scope", value: "col" }],
            children: [{ kind: "text", text: field.name }],
            kind: "component",
            name: "TableHead",
          }),
        ),
        kind: "component",
        name: "TableRow",
      },
    ],
    kind: "element",
    tag: "thead",
  };
}

/** A group-header row (only when grouped) spanning every column. */
function groupHeaderRow(entity: ReadonlyVow): UiNode {
  return {
    attrs: [{ expr: "grp.key !== null", kind: "cond", type: "if" }],
    children: [
      {
        attrs: [
          { kind: "static", name: "colspan", value: String(entity.fields.length) },
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

/** A data row — one `<TableCell>` per field, rendering that field's cell. */
function dataRow(entity: ReadonlyVow): UiNode {
  return {
    attrs: [],
    children: entity.fields.map(
      (field): UiNode => ({
        attrs: [{ kind: "static", name: "class", value: `field-${field.name}` }],
        children: [cellContent(field)],
        kind: "component",
        name: "TableCell",
      }),
    ),
    for: { as: "item", each: "grp.items", key: "item.id" },
    kind: "component",
    name: "TableRow",
  };
}

/** The `<tbody>` — group-header + data rows, looped per group. */
function tableBody(entity: ReadonlyVow): UiNode {
  return {
    attrs: [],
    children: [groupHeaderRow(entity), dataRow(entity)],
    for: { as: "grp", each: "grouped", key: "grp.key ?? '_'" },
    kind: "element",
    tag: "tbody",
  };
}

/** The whole list view — the Table when there are rows, else a friendly empty state. */
function listView(entity: ReadonlyVow): UiNode {
  return {
    attrs: [{ kind: "static", name: "class", value: `vow-view vow-view--${entity.slug}` }],
    children: [
      {
        attrs: [{ expr: "rows.length > 0", kind: "cond", type: "if" }],
        children: [tableHead(entity), tableBody(entity)],
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

/**
 * The read-only list of an entity — what a `## view` pulls in via `list: <entity>`. Emitted on demand
 * (because a view references it), never automatically. A pure display: no create form, no delete — the
 * studio is read-only, the agent mutates the data via the MCP. Any heading is the referencing view's job.
 */
export function emitEntityList(entity: ReadonlyVow, byId?: EntityLookup): string {
  assertEmitEntity(entity, "list");
  const type = pascalCase(entity.slug);
  const label = labelFieldOf(byId);
  const component: Component = {
    doc: [
      `Generated from vow "${entity.slug}" (the list view of an entity). The vow is the source — do not edit.`,
    ],
    imports: listImports(entity, type),
    name: type,
    setup: listSetup(entity, type, label),
    view: listView(entity),
  };
  return renderVueSfc(component);
}
