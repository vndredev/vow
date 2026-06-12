import type { Component, ReadonlyVow, UiNode } from "./types.ts";
import { groupedLines, sliceComputed } from "./slice.ts";
import { pascalCase, renderVueSfc } from "@vow/component";
import { assertEmitEntity } from "./entity-guard.ts";
import { bound } from "./helpers.ts";
import { cardsComponentName } from "./naming.ts";
import { recordCard } from "./record-card.ts";

/** The grouped grid of cards — a section per group, each a Grid of one Card per record. */
function cardsGrid(cardChildren: readonly UiNode[]): UiNode {
  return {
    attrs: [{ kind: "static", name: "class", value: "vow-cards-group" }],
    children: [
      {
        attrs: [
          { kind: "static", name: "class", value: "vow-cards-group__head" },
          { expr: "grp.key !== null", kind: "cond", type: "if" },
        ],
        children: [{ expr: "grp.key", kind: "interp" }],
        kind: "element",
        tag: "h3",
      },
      {
        attrs: [bound("columns", "3"), bound("gap", "4")],
        children: [
          {
            attrs: [],
            children: [...cardChildren],
            for: { as: "item", each: "grp.items", key: "item.id" },
            kind: "component",
            name: "Card",
          },
        ],
        kind: "component",
        name: "Grid",
      },
    ],
    for: { as: "grp", each: "grouped", key: "grp.key ?? '_'" },
    kind: "element",
    tag: "section",
  };
}

/** The whole cards view — the grouped grid, plus a friendly empty state when no records are displayed. */
function cardsView(entity: ReadonlyVow, cardChildren: readonly UiNode[]): UiNode {
  return {
    attrs: [{ kind: "static", name: "class", value: `vow-view vow-view--${entity.slug}` }],
    children: [
      cardsGrid(cardChildren),
      {
        attrs: [
          { kind: "static", name: "class", value: "vow-empty" },
          { expr: "displayed.length === 0", kind: "cond", type: "if" },
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
 * A cards composition over an entity — one `<Card>` per record (live from the shared store): its first
 * text field titles the card, the rest fill the body. A composition, not a primitive: it knows the
 * entity's fields + binds the store; it composes the `Card`/`CardHeader`/`CardBody` primitives in a Grid.
 */
export function emitEntityCards(entity: ReadonlyVow): string {
  assertEmitEntity(entity, "cards");
  const type = pascalCase(entity.slug);
  const cardChildren = recordCard(entity, []);
  const component: Component = {
    doc: [
      `Generated from vow "${entity.slug}" — a card per record. The vow is the source — do not edit.`,
    ],
    imports: [
      { from: "vue", names: ["computed"] },
      { from: "@vow/store", names: ["useCollection"] },
      { from: `./${entity.slug}.ts`, names: [`type ${type}`] },
      { default: "Grid", from: "./Grid.vue" },
      { default: "Card", from: "./Card.vue" },
      { default: "CardHeader", from: "./CardHeader.vue" },
      { default: "CardBody", from: "./CardBody.vue" },
    ],
    name: cardsComponentName(entity.slug),
    setup: [
      `const { items: rows } = useCollection<${type}>(${JSON.stringify(entity.slug)});`,
      ...sliceComputed(type, "displayed"),
      ...groupedLines(type, "displayed"),
    ],
    view: cardsView(entity, cardChildren),
  };
  return renderVueSfc(component);
}
