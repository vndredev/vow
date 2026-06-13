import type { Component, ReadonlyField, ReadonlyVow, UiNode } from "./types.ts";
import { assertEmitEntity, selectField } from "./entity-guard.ts";
import { humanizeFieldName, pascalCase, renderVueSfc } from "@vow/component";
import { recordCard, titleField } from "./record-card.ts";
import { boardComponentName } from "./naming.ts";
import { defined } from "@vow/core";
import { errorMessage } from "./status-message.ts";
import { scriptJson } from "./helpers.ts";
import { sliceComputed } from "./slice.ts";

/** The board setup — the store, the option list, the per-column computed, drag + keyboard handlers. */
function boardSetup(entity: ReadonlyVow, by: string, field: ReadonlyField): string[] {
  const type = pascalCase(entity.slug);
  const key = JSON.stringify(by);
  return [
    `const { items: rows, state, update } = useCollection<${type}>(${JSON.stringify(entity.slug)});`,
    `const options = ${scriptJson(field.options ?? [])};`,
    ...sliceComputed(type, "visible"),
    `const columns = computed(() =>`,
    `  options.map((o) => ({ option: o, cards: visible.value.filter((r) => r.${by} === o) })),`,
    `);`,
    `const dragged = ref<${type} | null>(null);`,
    `const announce = ref("");`,
    `function onDrop(option: string): void {`,
    `  if (dragged.value) update(dragged.value.id, { [${key}]: option });`,
    `  dragged.value = null;`,
    `}`,
    // A keyboard move (arrow keys) — shift the card to the adjacent column; the pointer-free mutation path.
    `function move(card: ${type}, delta: number): void {`,
    `  const option = options[options.indexOf(card.${by} as string) + delta];`,
    `  if (option === undefined) return; // off either end of the columns`,
    `  update(card.id, { [${key}]: option });`,
    `  announce.value = \`Moved to \${option}\`;`,
    `}`,
    // The move unmounts the focused card (it re-renders into another column's v-for), dropping focus to the
    // Body — refocus it via its stable id once the DOM settles, else the keyboard move is single-use (2.4.3).
    `async function moveCard(card: ${type}, delta: number): Promise<void> {`,
    `  move(card, delta);`,
    `  await nextTick();`,
    `  document.querySelector<HTMLElement>(\`[data-card-id="\${card.id}"]\`)?.focus();`,
    `}`,
  ];
}

/** A visually-hidden live region announcing keyboard moves to assistive tech (`role="status"`). */
function boardLiveRegion(): UiNode {
  return {
    attrs: [
      { kind: "static", name: "class", value: "vow-board__live" },
      { kind: "static", name: "role", value: "status" },
      { kind: "static", name: "aria-live", value: "polite" },
      {
        kind: "static",
        name: "style",
        value:
          "position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap",
      },
    ],
    children: [{ expr: "announce", kind: "interp" }],
    kind: "element",
    tag: "div",
  };
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

/**
 * The card's accessible name — its title field (so every card in a column is distinguishable), then the
 * humanized grouped field and its value. Falls back to the humanized grouped field alone when the entity
 * has no resolvable title field.
 */
function cardAriaLabel(by: string, title: ReadonlyField | undefined): string {
  const column = `${humanizeFieldName(by)}: \${item.${by}}`;
  const move = "Use the left and right arrows to move.";
  if (!defined(title)) {
    return `\`${column}. ${move}\``;
  }
  return `\`\${item.${title.name}}. ${column}. ${move}\``;
}

/**
 * A card per record in a column (the grouped field is omitted from its body). Draggable for pointers,
 * and a keyboard-operable control too: focusable (`tabindex`) with an `aria-label`, the left/right arrows
 * move it to the adjacent column — the pointer-free path to the board's only mutation (WCAG 2.1.1).
 */
function boardCard(entity: ReadonlyVow, by: string): UiNode {
  return {
    attrs: [
      { kind: "static", name: "class", value: "vow-board__card" },
      { kind: "static", name: "draggable", value: "true" },
      { kind: "static", name: "tabindex", value: "0" },
      { kind: "static", name: "role", value: "group" },
      {
        expr: cardAriaLabel(by, titleField(entity)),
        kind: "bound",
        name: "aria-label",
      },
      { expr: "item.id", kind: "bound", name: "data-card-id" },
      { expr: "dragged = item", kind: "event", name: "dragstart" },
      { expr: "moveCard(item, -1)", kind: "event", modifiers: ["left"], name: "keydown" },
      { expr: "moveCard(item, 1)", kind: "event", modifiers: ["right"], name: "keydown" },
    ],
    children: recordCard(entity, [by]),
    for: { as: "item", each: "col.cards", key: "item.id" },
    kind: "component",
    name: "Card",
  };
}

/** The board view — a column per option, each holding its draggable cards. A failed fetch leaves every
 *  column at zero, indistinguishable from a genuinely empty board, so the error branch surfaces it: a
 *  `.vow-empty` "Couldn't load this data" when the fetch errored on an empty set (never rendered as zero
 *  records). The columns stay rendered so a partial/late load keeps its drop targets. */
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
      boardLiveRegion(),
      errorMessage("state.error && rows.length === 0", "Couldn't load this data"),
    ],
    kind: "element",
    tag: "div",
  };
}

/**
 * A kanban board over an entity — a column per option of a `select` field, the records grouped into
 * their column (live from the store); dragging a card to another column writes that field back, and the
 * arrow keys move a focused card the same way (the pointer-free path), announced through a live region.
 * A composition: it knows the entity's field + binds the store; it composes the Card primitives.
 */
export function emitEntityBoard(entity: ReadonlyVow, by: string): string {
  assertEmitEntity(entity, "board");
  const field = selectField(entity, by, "board");
  const component: Component = {
    doc: [
      `Generated from vow "${entity.slug}" — a kanban of records by ${by}. The vow is the source — do not edit.`,
    ],
    imports: [
      { from: "vue", names: ["computed", "nextTick", "ref"] },
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
