import {
  pascalCase,
  renderVueSfc,
  type Attr,
  type Component,
  type ImportDecl,
  type UiNode,
} from "@vow/component";
import type { Vow } from "@vow/core";
import { LAYOUT_PRIMITIVES } from "@vow/layout";

/**
 * vow's view emitter — `emit view` made real.
 *
 * Two outputs: a page from a YAML `## view` (`emitView`, below) and the CRUD list of an entity
 * (`emitEntityList`). The list is emitted **on demand** — only when a `## view` pulls it in via
 * `list: <entity>` — so an `emit entity` stays a pure model, never auto-rendered. Both are built as a
 * canonical `Component` and rendered by the Vue adapter (`renderVueSfc`); the imperative glue (refs,
 * add/remove) lives in `setup`. Boolean fields render as the emitted, accessible `<Checkbox>`. The
 * output is **unstyled** — only class hooks; styling lives in the swappable `@vow/theme`. React/Solid
 * would reuse the same Component via a different adapter.
 */

/**
 * The CRUD list of an entity — what a `## view` pulls in via `list: <entity>`. Emitted on demand
 * (because a view references it), never automatically. Any heading is the referencing view's job, so
 * the list carries none of its own.
 */
export function emitEntityList(entity: Vow): string {
  if (entity.fulfills?.kind !== "emit" || entity.fulfills.as !== "entity") {
    throw new Error(`emit-view: \`list:\` target "${entity.slug}" must be an \`emit entity\``);
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
    // items is optional (default empty) so the view drops into a `## view` as `list: <slug>` with no props
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
      `Generated from vow "${entity.slug}" (the list view of an entity). The vow is the source — do not edit.`,
    ],
    imports,
    setup,
    view: {
      kind: "element",
      tag: "section",
      attrs: [{ kind: "static", name: "class", value: `vow-view vow-view--${entity.slug}` }],
      children: [
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

/** The PascalCase component name for an entity's list view (`task` → `Task`). */
export function viewComponentName(entity: Vow): string {
  return pascalCase(entity.slug);
}

/**
 * The vow-native view path — `emit view` from a YAML `## view`.
 *
 * The core parses it UI-agnostically (`ViewNode[]`); here each component becomes a `UiNode`. Semantic
 * blocks (`hero`, `features`) expand into primitive trees; `list: <entity>` references a generated
 * view; layout primitives (`flex`/`box`/`grid`) + text tags (`h1`/`p`/…) + `text` are the escape
 * hatch — the full model, so anything from a landing page to a SaaS screen is expressible. Numeric
 * props stay numbers (`:gap="4"`), the rest become string literals. The catalog is sugar over the
 * escape; nothing a block can do is impossible in primitives.
 */

/** Plain text-bearing HTML elements a view may use directly (headings, paragraphs, inline). */
const TEXT_TAGS: readonly string[] = ["h1", "h2", "h3", "p", "span"];

/** A YAML scalar as a string (object/array values become empty — they aren't content). */
const str = (v: unknown): string =>
  typeof v === "string" ? v : typeof v === "number" || typeof v === "boolean" ? String(v) : "";

const txt = (s: string): UiNode => ({ kind: "text", text: s });
const el = (tag: string, children: UiNode[]): UiNode => ({
  kind: "element",
  tag,
  attrs: [],
  children,
});
const comp = (name: string, attrs: Attr[], children: UiNode[]): UiNode => ({
  kind: "component",
  name,
  attrs,
  children,
});
const bound = (name: string, expr: string): Attr => ({ kind: "bound", name, expr });

/** A raw YAML value as an object (props + optional `children`); non-objects → empty. */
function asObject(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Map raw props (every key but `children`) to bound attrs: numbers stay numbers, else string literals. */
function propsToAttrs(value: Record<string, unknown>): Attr[] {
  return Object.entries(value)
    .filter(([k]) => k !== "children")
    .map(([name, v]) =>
      bound(name, typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "\\'")}'`),
    );
}

/** Map a node's `children:` (raw single-key objects) to UiNodes. */
function childrenOf(value: Record<string, unknown>, entities: readonly string[]): UiNode[] {
  const kids = value["children"];
  return Array.isArray(kids) ? kids.map((k) => rawToUiNode(k, entities)) : [];
}

/** Map a raw single-key YAML node (`{ flex: {...} }`) to a UiNode. */
function rawToUiNode(raw: unknown, entities: readonly string[]): UiNode {
  const obj = asObject(raw);
  const type = Object.keys(obj)[0] ?? "";
  return mapNode(type, obj[type], entities);
}

/**
 * Map one component (`type` + raw `value`) to a UiNode. `entities` are the entity slugs a `list:`
 * may reference. Semantic blocks expand into primitive trees; primitives/text tags/`text` are the
 * escape hatch.
 */
function mapNode(type: string, value: unknown, entities: readonly string[]): UiNode {
  if (type === "hero") {
    const o = asObject(value);
    const kids: UiNode[] = [];
    if (o["eyebrow"] !== undefined) kids.push(el("span", [txt(str(o["eyebrow"]))]));
    if (o["title"] !== undefined) kids.push(el("h1", [txt(str(o["title"]))]));
    if (o["lead"] !== undefined) kids.push(el("p", [txt(str(o["lead"]))]));
    return comp("Flex", [bound("direction", "'column'"), bound("gap", "3")], kids);
  }
  if (type === "features") {
    const cards = (Array.isArray(value) ? value : []).map((it) => {
      const o = asObject(it);
      const inner: UiNode[] = [];
      if (o["title"] !== undefined) inner.push(el("h3", [txt(str(o["title"]))]));
      if (o["body"] !== undefined) inner.push(el("p", [txt(str(o["body"]))]));
      return comp("Box", [bound("p", "5")], inner);
    });
    return comp("Grid", [bound("columns", "3"), bound("gap", "4")], cards);
  }
  if (type === "list") {
    const slug = str(value);
    if (!entities.includes(slug)) {
      throw new Error(
        `emit-view: \`list: ${slug}\` references an unknown entity (known: ${entities.join(", ") || "none"})`,
      );
    }
    return comp(pascalCase(slug), [], []);
  }
  if (LAYOUT_PRIMITIVES.includes(pascalCase(type))) {
    const o = asObject(value);
    return comp(pascalCase(type), propsToAttrs(o), childrenOf(o, entities));
  }
  if (TEXT_TAGS.includes(type)) {
    return el(type, [txt(str(value))]);
  }
  if (type === "text") {
    return txt(str(value));
  }
  throw new Error(`emit-view: unknown view component "${type}"`);
}

/** Collect every `<Component>` name in a UiNode tree (for imports). */
function componentsIn(node: UiNode, acc: Set<string> = new Set()): Set<string> {
  if (node.kind === "component") acc.add(node.name);
  if (node.kind === "element" || node.kind === "component" || node.kind === "slot") {
    for (const c of node.children) componentsIn(c, acc);
  }
  return acc;
}

/**
 * A view from a YAML `## view` — a list of components rendered to a Vue SFC, wrapped in a `vow-app`
 * root. `entities` are the entity slugs a `list:` may reference; every `<Component>` in the result
 * (primitives + referenced views) is imported from its `.generated/` `.vue`.
 */
export function emitView(view: Vow, entities: readonly string[] = []): string {
  if (!view.view) throw new Error(`emit-view: vow "${view.slug}" has no \`## view\``);
  const nodes = view.view.map((vn) => mapNode(vn.type, vn.value, entities));
  const root: UiNode = {
    kind: "element",
    tag: "div",
    attrs: [{ kind: "static", name: "class", value: "vow-app" }],
    children: nodes,
  };
  const imports: ImportDecl[] = [...componentsIn(root)].map((name) => ({
    from: `./${name}.vue`,
    default: name,
  }));
  const component: Component = {
    name: pascalCase(view.slug),
    doc: [
      `Generated from vow "${view.slug}" (a \`## view\`). The vow is the source — do not edit.`,
    ],
    imports,
    view: root,
  };
  return renderVueSfc(component);
}

/**
 * A prose page from already-rendered markdown nodes (see `@vow/markdown` `markdownToNodesSync`). The
 * nodes are wrapped in a `vow-doc` container; any embedded `<Component>` is imported from its generated
 * `.vue`. The markdown file is the source — this is generated. Lets the docs be a vow app whose content
 * stays as plain `.md` (scanned by the plugin), rendered through the core, not a parallel doc-system.
 */
export function emitProse(slug: string, nodes: readonly UiNode[]): string {
  const root: UiNode = {
    kind: "element",
    tag: "div",
    attrs: [{ kind: "static", name: "class", value: "vow-doc" }],
    children: [...nodes],
  };
  const imports: ImportDecl[] = [...componentsIn(root)].map((name) => ({
    from: `./${name}.vue`,
    default: name,
  }));
  const component: Component = {
    name: pascalCase(slug),
    doc: [
      `Generated prose page "${slug}" (from markdown). The markdown is the source — do not edit.`,
    ],
    imports,
    view: root,
  };
  return renderVueSfc(component);
}

/**
 * Every entity slug a view references via `list:` — recursing into primitive `children`. The plugin
 * uses this to emit each referenced entity's list on demand (the entity itself stays a pure model).
 */
export function listedEntities(view: Vow): string[] {
  const found = new Set<string>();
  const walk = (type: string, value: unknown): void => {
    if (type === "list") {
      found.add(str(value));
      return;
    }
    const kids = asObject(value)["children"];
    if (!Array.isArray(kids)) return;
    for (const kid of kids) {
      const obj = asObject(kid);
      const key = Object.keys(obj)[0];
      if (key !== undefined) walk(key, obj[key]);
    }
  };
  for (const node of view.view ?? []) walk(node.type, node.value);
  return [...found];
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
