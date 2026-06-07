import {
  pascalCase,
  renderVueSfc,
  type Component,
  type ImportDecl,
  type UiNode,
} from "@vow/component";
import type { TreeNode, Vow } from "@vow/core";
import { LAYOUT_PRIMITIVES } from "@vow/layout";

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
    // items is optional (default empty) so the view drops into a `## tree` as `- <Name>` with no props
    `const props = withDefaults(defineProps<{ items?: ${type}[] }>(), { items: () => [] });`,
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
        expr: `'Delete: ' + item.${inputFields[0]?.name ?? "title"}`,
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
    children: [{ kind: "text", text: "+ Add" }],
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

/**
 * The vow-native layout path — `emit view` from a `## tree`.
 *
 * The core parses the tree UI-agnostically (`TreeNode`); here it becomes a `UiNode`: a `slot` node is
 * an outlet, every other node is a layout primitive (`Flex`/`Grid`/…) rendered as a `<Component>`.
 * Raw string props become bound attrs with the right JS literal — a numeric value is a `number`
 * (`:gap="4"`), anything else a string (`:direction="'column'"`) — so the primitive receives the
 * typed prop, not a stringified one. This is the seam that lets a `.vow.md` express layout itself.
 */

/** Plain text-bearing HTML elements a tree may use directly (headings, paragraphs, inline). */
const TEXT_TAGS: readonly string[] = ["h1", "h2", "h3", "p", "span"];

/** True for tree nodes that are markup, not a referenced component (`slot`, `text`, a text tag). */
function isReserved(component: string): boolean {
  return component === "slot" || component === "text" || TEXT_TAGS.includes(component);
}

/**
 * Map a parsed `TreeNode` to a `UiNode`. `slot` → outlet; `text`/a text tag → markup; a layout
 * primitive OR a known generated view (e.g. `- Task`) → `<Component>`. `knownViews` are the generated
 * view component names the tree is allowed to reference.
 */
function treeToUiNode(node: TreeNode, knownViews: readonly string[]): UiNode {
  if (node.component === "slot") {
    const name = node.props["name"];
    return {
      kind: "slot",
      ...(name !== undefined ? { name } : {}),
      children: node.children.map((c) => treeToUiNode(c, knownViews)),
    };
  }
  if (node.component === "text") {
    return { kind: "text", text: node.props["value"] ?? "" };
  }
  if (TEXT_TAGS.includes(node.component)) {
    // a text-bearing HTML element (h1/p/…): its quoted children are its content
    return {
      kind: "element",
      tag: node.component,
      attrs: [],
      children: node.children.map((c) => treeToUiNode(c, knownViews)),
    };
  }
  if (!LAYOUT_PRIMITIVES.includes(node.component) && !knownViews.includes(node.component)) {
    throw new Error(
      `emit-view: unknown tree component "${node.component}" (known: ${[...LAYOUT_PRIMITIVES, ...knownViews].join(", ")}, ${TEXT_TAGS.join(", ")}, slot, text)`,
    );
  }
  return {
    kind: "component",
    name: node.component,
    attrs: Object.entries(node.props).map(([name, value]) => ({
      kind: "bound",
      name,
      // a number stays a number; everything else is a quoted string literal
      expr: /^-?\d+(?:\.\d+)?$/.test(value) ? value : `'${value.replace(/'/g, "\\'")}'`,
    })),
    children: node.children.map((c) => treeToUiNode(c, knownViews)),
  };
}

/** Every component a tree references (layout primitives + generated views) — each imported from ./<Name>.vue. */
function componentsInTree(node: TreeNode, acc: Set<string> = new Set()): Set<string> {
  if (!isReserved(node.component)) acc.add(node.component);
  for (const child of node.children) componentsInTree(child, acc);
  return acc;
}

/**
 * A view whose layout is its `## tree` — composed from layout primitives, text, and generated views
 * (e.g. `- Task`), rendered to a Vue SFC. `knownViews` lists the generated view component names the
 * tree may reference; each referenced component is imported from its `.generated/` `.vue`.
 */
export function emitTreeView(view: Vow, knownViews: readonly string[] = []): string {
  if (!view.tree) throw new Error(`emit-view: vow "${view.slug}" has no \`## tree\``);
  const root = treeToUiNode(view.tree, knownViews); // validates every node up front
  const imports: ImportDecl[] = [...componentsInTree(view.tree)].map((name) => ({
    from: `./${name}.vue`,
    default: name,
  }));
  const component: Component = {
    name: pascalCase(view.slug),
    doc: [
      `Generated from vow "${view.slug}" (a \`## tree\` layout). The vow is the source — do not edit.`,
    ],
    imports,
    view: root,
  };
  return renderVueSfc(component);
}

/**
 * The generated boot — replaces a hand-written `src/main.ts`. Mounts the `root` page on `#app` and
 * imports the default theme. So a vow app needs no boot shell: the entry is a vow (`root: true`).
 */
export function emitBoot(rootSlug: string, theme: string | false = "@vow/theme/vow.css"): string {
  const name = pascalCase(rootSlug);
  const lines = [
    `// Generated boot for the root vow "${rootSlug}". The vow is the source — do not edit.`,
    `import { createApp } from "vue";`,
  ];
  if (theme) lines.push(`import "${theme}";`);
  lines.push(
    `import ${name} from "./${rootSlug}.vue";`,
    ``,
    `createApp(${name}).mount("#app");`,
    ``,
  );
  return lines.join("\n");
}

/** Ambient `*.vue` / `*.css` shims the generated boot needs for tsgo — written into `.generated/`. */
export const VOW_ENV_DTS = [
  `/** SFC + CSS shims so tsgo accepts .vue / .css imports (Volar/vue-tsc give the deep check). */`,
  `declare module "*.vue" {`,
  `  import type { DefineComponent } from "vue";`,
  `  const component: DefineComponent;`,
  `  export default component;`,
  `}`,
  `declare module "*.css";`,
  ``,
].join("\n");
