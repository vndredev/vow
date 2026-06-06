import {
  pascalCase,
  renderVueSfc,
  type Component,
  type ImportDecl,
  type UiNode,
} from "@vow/component";
import type { Vow } from "@vow/core";

/**
 * vow's view emitter — `emit view` made real (CRUD over local state).
 *
 * The view is built as a canonical `Component` and rendered by the Vue adapter (`renderVueSfc`); the
 * imperative glue (refs, add/remove) lives in `setup`. Boolean fields render as the emitted,
 * accessible `<Checkbox>`. The view is **unstyled** — only class hooks; styling lives in the
 * swappable `@vow/theme`. React/Solid would reuse the same Component via a different adapter.
 */

/** A Vue CRUD view over an entity, expressed as a Component and rendered by renderVueSfc. */
export function emitViewSfc(view: Vow, entity: Vow): string {
  if (view.fulfills?.kind !== "emit" || view.fulfills.as !== "view") {
    throw new Error(`emit-view: vow "${view.slug}" is not an \`emit view\``);
  }
  if (entity.fulfills?.kind !== "emit" || entity.fulfills.as !== "entity") {
    throw new Error(`emit-view: view "${view.slug}" must be \`of\` an \`emit entity\``);
  }
  const type = pascalCase(entity.slug);
  const hasBoolean = entity.fields.some((f) => f.type === "boolean");
  const inputFields = entity.fields.filter((f) => f.type !== "boolean");

  const imports: ImportDecl[] = [
    { from: "vue", names: ["ref"] },
    { from: `./${entity.slug}.ts`, names: [`create${type}`, `type ${type}`] },
  ];
  if (hasBoolean) imports.push({ from: "./Checkbox.vue", default: "Checkbox" });

  const setup: string[] = [
    `const props = defineProps<{ items: ${type}[] }>();`,
    `const rows = ref<${type}[]>(props.items.map((item) => ({ ...item })));`,
    `const draft = ref<Partial<${type}>>({});`,
    ``,
    `function add(): void {`,
    `  try {`,
    `    rows.value.push(create${type}(draft.value));`,
    `    draft.value = {};`,
    `  } catch {`,
    `    // invalid draft (e.g. a required field is empty) — ignore until we surface validation`,
    `  }`,
    `}`,
    `function remove(index: number): void {`,
    `  rows.value.splice(index, 1);`,
    `}`,
  ];

  // one display cell per field: boolean → <Checkbox>, everything else → a <span> with the value
  const cells: UiNode[] = entity.fields.map(
    (f): UiNode =>
      f.type === "boolean"
        ? {
            kind: "component",
            name: "Checkbox",
            attrs: [
              { kind: "model", expr: `item.${f.name}` },
              { kind: "static", name: "label", value: f.name },
            ],
            children: [],
          }
        : {
            kind: "element",
            tag: "span",
            attrs: [{ kind: "static", name: "class", value: `vow-view__field field-${f.name}` }],
            children: [{ kind: "interp", expr: `item.${f.name}` }],
          },
  );

  const deleteButton: UiNode = {
    kind: "element",
    tag: "button",
    attrs: [
      { kind: "static", name: "class", value: "vow-view__delete" },
      { kind: "static", name: "type", value: "button" },
      {
        kind: "bound",
        name: "aria-label",
        expr: `'Löschen: ' + item.${inputFields[0]?.name ?? "title"}`,
      },
      { kind: "event", name: "click", expr: "remove(i)" },
    ],
    children: [{ kind: "text", text: "✕" }],
  };

  // one input per non-boolean field: select → inline options, date → date input, else text/number
  const inputs: UiNode[] = inputFields.map((f): UiNode => {
    if (f.type === "select") {
      return {
        kind: "element",
        tag: "select",
        inline: true,
        attrs: [
          { kind: "static", name: "class", value: "vow-view__input" },
          { kind: "model", expr: `draft.${f.name}` },
          { kind: "static", name: "aria-label", value: f.name },
        ],
        children: (f.options ?? []).map(
          (o): UiNode => ({
            kind: "element",
            tag: "option",
            attrs: [{ kind: "static", name: "value", value: o }],
            children: [{ kind: "text", text: o }],
          }),
        ),
      };
    }
    if (f.type === "date") {
      return {
        kind: "element",
        tag: "input",
        attrs: [
          { kind: "static", name: "class", value: "vow-view__input" },
          { kind: "static", name: "type", value: "date" },
          { kind: "model", expr: `draft.${f.name}` },
          { kind: "static", name: "aria-label", value: f.name },
        ],
        children: [],
      };
    }
    return {
      kind: "element",
      tag: "input",
      attrs: [
        { kind: "static", name: "class", value: "vow-view__input" },
        f.type === "number"
          ? { kind: "model", expr: `draft.${f.name}`, modifiers: ["number"] }
          : { kind: "model", expr: `draft.${f.name}` },
        { kind: "static", name: "placeholder", value: f.name },
        { kind: "static", name: "aria-label", value: f.name },
      ],
      children: [],
    };
  });

  const addButton: UiNode = {
    kind: "element",
    tag: "button",
    attrs: [
      { kind: "static", name: "class", value: "vow-view__add" },
      { kind: "static", name: "type", value: "submit" },
    ],
    children: [{ kind: "text", text: "+ Hinzufügen" }],
  };

  const component: Component = {
    name: type,
    doc: [
      `Generated from vow "${view.slug}" (a view of "${entity.slug}"). The vow tree is the source — do not edit.`,
    ],
    imports,
    setup,
    view: {
      kind: "element",
      tag: "section",
      attrs: [{ kind: "static", name: "class", value: `vow-view vow-view--${view.slug}` }],
      children: [
        {
          kind: "element",
          tag: "h1",
          attrs: [{ kind: "static", name: "class", value: "vow-view__title" }],
          children: [{ kind: "text", text: view.intent }],
        },
        {
          kind: "element",
          tag: "ul",
          attrs: [{ kind: "static", name: "class", value: "vow-view__list" }],
          children: [
            {
              kind: "element",
              tag: "li",
              attrs: [{ kind: "static", name: "class", value: "vow-view__row" }],
              for: { each: "rows", as: "item", index: "i", key: "i" },
              children: [...cells, deleteButton],
            },
          ],
        },
        {
          kind: "element",
          tag: "form",
          attrs: [
            { kind: "static", name: "class", value: "vow-view__create" },
            { kind: "event", name: "submit", expr: "add", modifiers: ["prevent"] },
          ],
          children: [...inputs, addButton],
        },
      ],
    },
  };

  return renderVueSfc(component);
}

/** The PascalCase component name for an entity's default view (`task` → `Task`). */
export function viewComponentName(entity: Vow): string {
  return pascalCase(entity.slug);
}

/**
 * The default list view over an entity — no separate view vow needed. The entity is treated as its
 * own view, so a single `task.vow.md` yields the model AND its CRUD list.
 */
export function emitDefaultView(entity: Vow): string {
  return emitViewSfc(
    { ...entity, fulfills: { kind: "emit", as: "view" }, of: entity.slug },
    entity,
  );
}
