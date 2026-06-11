import type { Component, ReadonlyField, ReadonlyVow, UiNode } from "./types.ts";
import { assertEmitEntity, selectField } from "./entity-guard.ts";
import { pascalCase, renderVueSfc } from "@vow/component";
import { boardComponentName } from "./naming.ts";
import { recordCard } from "./record-card.ts";
import { sliceComputed } from "./slice.ts";

/** The board setup — the store, the option list, the per-column computed, and the drag handler. */
function boardSetup(entity: ReadonlyVow, by: string, field: ReadonlyField): string[] {
  const type = pascalCase(entity.slug);
  return [
    `const { items: rows, update } = useCollection<${type}>(${JSON.stringify(entity.slug)});`,
    `const options = ${JSON.stringify(field.options ?? [])};`,
    ...sliceComputed(type, "visible"),
    `const columns = computed(() =>`,
    `  options.map((o) => ({ option: o, cards: visible.value.filter((r) => r.${by} === o) })),`,
    `);`,
    `const dragged = ref<${type} | null>(null);`,
    `function onDrop(option: string): void {`,
    `  if (dragged.value) update(dragged.value.id, { [${JSON.stringify(by)}]: option });`,
    `  dragged.value = null;`,
    `}`,
  ];
}

/** A column header — the option name + a count. */
function boardColumnHead(): UiNode {
  return {
    attrs: [{ kind: "static", name: "class", value: "vow-board__col-head" }],
    children: [
      { expr: "col.option", kind: "interp" },
      {
        attrs: [{ kind: "static", name: "class", value: "vow-board__count" }],
        children: [{ expr: "col.cards.length", kind: "interp" }],
        kind: "element",
        tag: "span",
      },
    ],
    kind: "element",
    tag: "div",
  };
}

/** A draggable card per record in a column (the grouped field is omitted from its body). */
function boardCard(entity: ReadonlyVow, by: string): UiNode {
  return {
    attrs: [
      { kind: "static", name: "class", value: "vow-board__card" },
      { kind: "static", name: "draggable", value: "true" },
      { expr: "dragged = item", kind: "event", name: "dragstart" },
    ],
    children: recordCard(entity, [by]),
    for: { as: "item", each: "col.cards", key: "item.id" },
    kind: "component",
    name: "Card",
  };
}

/** The board view — a column per option, each holding its draggable cards. */
function boardView(entity: ReadonlyVow, by: string): UiNode {
  return {
    attrs: [{ kind: "static", name: "class", value: "vow-board" }],
    children: [
      {
        attrs: [
          { kind: "static", name: "class", value: "vow-board__col" },
          { expr: "", kind: "event", modifiers: ["prevent"], name: "dragover" },
          { expr: "onDrop(col.option)", kind: "event", name: "drop" },
        ],
        children: [boardColumnHead(), boardCard(entity, by)],
        for: { as: "col", each: "columns", key: "col.option" },
        kind: "element",
        tag: "div",
      },
    ],
    kind: "element",
    tag: "div",
  };
}

/**
 * A kanban board over an entity — a column per option of a `select` field, the records grouped into
 * their column (live from the store); dragging a card to another column writes that field back. A
 * composition: it knows the entity's field + binds the store; it composes the Card primitives.
 */
export function emitEntityBoard(entity: ReadonlyVow, by: string): string {
  assertEmitEntity(entity, "board");
  const field = selectField(entity, by, "board");
  const component: Component = {
    doc: [
      `Generated from vow "${entity.slug}" — a kanban of records by ${by}. The vow is the source — do not edit.`,
    ],
    imports: [
      { from: "vue", names: ["computed", "ref"] },
      { from: "@vow/store", names: ["useCollection"] },
      { from: `./${entity.slug}.ts`, names: [`type ${pascalCase(entity.slug)}`] },
      { default: "Card", from: "./Card.vue" },
      { default: "CardHeader", from: "./CardHeader.vue" },
      { default: "CardBody", from: "./CardBody.vue" },
    ],
    name: boardComponentName(entity.slug, by),
    setup: boardSetup(entity, by, field),
    view: boardView(entity, by),
  };
  return renderVueSfc(component);
}
