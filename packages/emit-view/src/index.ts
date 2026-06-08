import {
  pascalCase,
  renderVueSfc,
  type Attr,
  type Component,
  type ImportDecl,
  type UiNode,
} from "@vow/component";
import type { Field, Vow } from "@vow/core";
import { PRIMITIVE_ADAPTERS } from "@vow/emit-primitive";
import { LAYOUT_PRIMITIVES } from "@vow/layout";

/** The primitive names a `## view` may reference directly (the closed registry, from @vow/emit-primitive). */
const PRIMITIVES: readonly string[] = Object.keys(PRIMITIVE_ADAPTERS);

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
 * The input control for one field — the shared field→control map, reused by the entity list and (later)
 * the standalone form. select + reference render vow's Select primitive; date a native date input;
 * longtext a textarea; text/number a native input. `model` is the v-model expression (e.g. `draft.title`);
 * a reference reads its target's `<field>Choices` (a computed the caller defines in setup).
 */
export function fieldControl(f: Field, model: string): UiNode {
  if (f.type === "select") {
    const opts = (f.options ?? [])
      .map((o) => `{ value: '${o.replace(/'/g, "\\'")}', label: '${o.replace(/'/g, "\\'")}' }`)
      .join(", ");
    return {
      kind: "component",
      name: "Select",
      attrs: [
        { kind: "model", expr: model },
        { kind: "bound", name: "options", expr: `[${opts}]` },
        { kind: "static", name: "label", value: f.name },
      ],
      children: [],
    };
  }
  if (f.type === "reference") {
    // vow's Select primitive over the target entity's shared collection (only existing items selectable)
    return {
      kind: "component",
      name: "Select",
      attrs: [
        { kind: "model", expr: model },
        { kind: "bound", name: "options", expr: `${f.name}Choices` },
        { kind: "static", name: "label", value: f.name },
      ],
      children: [],
    };
  }
  if (f.type === "date") {
    return {
      kind: "element",
      tag: "input",
      attrs: [
        { kind: "static", name: "class", value: "vow-input" },
        { kind: "static", name: "type", value: "date" },
        { kind: "model", expr: model },
        { kind: "static", name: "aria-label", value: f.name },
      ],
      children: [],
    };
  }
  if (f.type === "longtext") {
    return {
      kind: "element",
      tag: "textarea",
      attrs: [
        { kind: "static", name: "class", value: "vow-input vow-textarea" },
        { kind: "model", expr: model },
        { kind: "static", name: "placeholder", value: f.name },
        { kind: "static", name: "aria-label", value: f.name },
      ],
      children: [],
    };
  }
  return {
    kind: "element",
    tag: "input",
    attrs: [
      { kind: "static", name: "class", value: "vow-input" },
      f.type === "number"
        ? { kind: "model", expr: model, modifiers: ["number"] }
        : { kind: "model", expr: model },
      { kind: "static", name: "placeholder", value: f.name },
      { kind: "static", name: "aria-label", value: f.name },
    ],
    children: [],
  };
}

/**
 * The CRUD list of an entity — what a `## view` pulls in via `list: <entity>`. Emitted on demand
 * (because a view references it), never automatically. Any heading is the referencing view's job, so
 * the list carries none of its own.
 */
export function emitEntityList(entity: Vow, byId?: Map<string, Vow>): string {
  if (entity.fulfills?.kind !== "emit" || entity.fulfills.as !== "entity") {
    throw new Error(`emit-view: \`list:\` target "${entity.slug}" must be an \`emit entity\``);
  }
  const type = pascalCase(entity.slug);
  const hasBoolean = entity.fields.some((f) => f.type === "boolean");
  const inputFields = entity.fields.filter((f) => f.type !== "boolean");
  const referenceFields = inputFields.filter((f) => f.type === "reference");
  // a reference dropdown labels each target item by the target entity's first text field (else its id)
  const labelField = (ref?: string): string =>
    byId?.get(ref ?? "")?.fields.find((tf) => tf.type === "text")?.name ?? "id";

  const hasSelectLike = inputFields.some((f) => f.type === "select" || f.type === "reference");

  const imports: ImportDecl[] = [
    { from: "vue", names: referenceFields.length > 0 ? ["ref", "computed"] : ["ref"] },
    { from: "@vow/store", names: ["useCollection"] },
    { from: `./${entity.slug}.ts`, names: [`create${type}`, `type ${type}`] },
  ];
  if (hasBoolean) imports.push({ from: "./Checkbox.vue", default: "Checkbox" });
  if (hasSelectLike) imports.push({ from: "./Select.vue", default: "Select" }); // select + reference

  const setup: string[] = [
    // the shared store holds the items (one array per slug) — so a reference field can read another
    // entity's items; the local `ref`-per-view is gone
    `const { items: rows, append, removeAt } = useCollection<${type}>(${JSON.stringify(entity.slug)});`,
    `const draft = ref<Partial<${type}>>({});`,
    ``,
    `function add(): void {`,
    `  try {`,
    `    append(create${type}(draft.value));`,
    `    draft.value = {};`,
    `  } catch {`,
    `    // invalid draft (e.g. a required field is empty) — ignore until we surface validation`,
    `  }`,
    `}`,
    `function remove(index: number): void {`,
    `  removeAt(index);`,
    `}`,
  ];
  // a reference dropdown reads the target entity's shared collection, mapped to Select {value,label}
  for (const f of referenceFields) {
    setup.push(
      `const ${f.name}Options = useCollection<{ id: string } & Record<string, unknown>>(${JSON.stringify(f.ref ?? "")}).items;`,
      `const ${f.name}Choices = computed(() => ${f.name}Options.map((t) => ({ value: t.id, label: String(t.${labelField(f.ref)}) })));`,
    );
  }

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

  // one input per non-boolean field — the shared field→control map (reused by the standalone form)
  const inputs: UiNode[] = inputFields.map((f) => fieldControl(f, `draft.${f.name}`));

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
              for: { each: "rows", as: "item", index: "i", key: "item.id" },
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

/** A live `role="alert"` error paragraph for a field, shown only when `errors.<name>` is set. */
function errorNode(name: string): UiNode {
  return {
    kind: "element",
    tag: "p",
    attrs: [
      { kind: "static", name: "class", value: "vow-field__error" },
      { kind: "static", name: "role", value: "alert" },
      { kind: "cond", type: "if", expr: `errors.${name}` },
    ],
    children: [{ kind: "interp", expr: `errors.${name}` }],
  };
}

/** Wire a native control to its field: the shared id (for the label), aria-describedby, aria-invalid. A
 *  Select component keeps its own aria-label, so it's returned unchanged. */
function withControlId(control: UiNode, name: string): UiNode {
  if (control.kind !== "element") return control;
  return {
    ...control,
    attrs: [
      ...control.attrs,
      { kind: "bound", name: "id", expr: `${name}Id` },
      { kind: "bound", name: "aria-describedby", expr: `${name}Id + '-error'` },
      { kind: "bound", name: "aria-invalid", expr: `!!errors.${name}` },
    ],
  };
}

/** One field in a form: a boolean self-labels as a <Checkbox>; everything else is a labelled <Field>. */
function formField(f: Field): UiNode {
  if (f.type === "boolean") {
    return {
      kind: "element",
      tag: "div",
      attrs: [{ kind: "static", name: "class", value: "vow-field" }],
      children: [
        {
          kind: "component",
          name: "Checkbox",
          attrs: [
            { kind: "model", expr: `draft.${f.name}` },
            { kind: "static", name: "label", value: f.name },
          ],
          children: [],
        },
        errorNode(f.name),
      ],
    };
  }
  return {
    kind: "component",
    name: "Field",
    attrs: [
      { kind: "static", name: "label", value: f.name },
      { kind: "bound", name: "control-id", expr: `${f.name}Id` },
      { kind: "bound", name: "error", expr: `errors.${f.name}` },
    ],
    children: [withControlId(fieldControl(f, `draft.${f.name}`), f.name)],
  };
}

/**
 * A form from a `## form` (an `emit form` vow), bound to an entity via `of:`. Each entity field renders
 * as a labelled `<Field>` (a boolean self-labels as `<Checkbox>`); on submit it validates with the
 * entity's zod schema (via `create<Name>`) and surfaces the per-field errors. `byId` resolves the bound
 * entity and any reference targets.
 */
export function emitForm(form: Vow, byId: Map<string, Vow>): string {
  const spec = form.form;
  if (!spec?.of) {
    throw new Error(`emit-form: "${form.slug}" needs a \`## form\` with \`of: <entity>\``);
  }
  const entity = byId.get(spec.of);
  if (!entity || entity.fulfills?.kind !== "emit" || entity.fulfills.as !== "entity") {
    throw new Error(`emit-form: "${form.slug}" form \`of: ${spec.of}\` is not a known entity`);
  }
  const name = pascalCase(spec.of);
  const fields = entity.fields;
  const referenceFields = fields.filter((f) => f.type === "reference");
  const nativeFields = fields.filter((f) => f.type !== "boolean"); // each gets a useId for its label
  const labelField = (ref?: string): string =>
    byId.get(ref ?? "")?.fields.find((tf) => tf.type === "text")?.name ?? "id";

  const vueNames = referenceFields.length > 0 ? ["ref", "useId", "computed"] : ["ref", "useId"];
  const imports: ImportDecl[] = [
    { from: "vue", names: vueNames },
    { from: "zod", names: ["ZodError"] },
    { from: `./${spec.of}.ts`, names: [`create${name}`, `type ${name}`] },
    { from: "@vow/store", names: ["useCollection"] },
    { from: "./Field.vue", default: "Field" },
    { from: "./Button.vue", default: "Button" },
  ];
  if (fields.some((f) => f.type === "boolean")) {
    imports.push({ from: "./Checkbox.vue", default: "Checkbox" });
  }
  if (fields.some((f) => f.type === "select" || f.type === "reference")) {
    imports.push({ from: "./Select.vue", default: "Select" });
  }

  const setup: string[] = [
    `const { append } = useCollection<${name}>(${JSON.stringify(spec.of)});`,
    `const draft = ref<Partial<${name}>>({});`,
    `const errors = ref<Record<string, string>>({});`,
  ];
  for (const f of nativeFields) setup.push(`const ${f.name}Id = useId();`);
  for (const f of referenceFields) {
    setup.push(
      `const ${f.name}Options = useCollection<{ id: string } & Record<string, unknown>>(${JSON.stringify(f.ref ?? "")}).items;`,
      `const ${f.name}Choices = computed(() => ${f.name}Options.map((t) => ({ value: t.id, label: String(t.${labelField(f.ref)}) })));`,
    );
  }
  setup.push(
    ``,
    `function submit(): void {`,
    `  try {`,
    `    append(create${name}(draft.value));`,
    `    draft.value = {};`,
    `    errors.value = {};`,
    `  } catch (err) {`,
    `    if (err instanceof ZodError) {`,
    `      errors.value = Object.fromEntries(err.issues.map((i) => [String(i.path[0]), i.message]));`,
    `    }`,
    `  }`,
    `}`,
  );

  const submitButton: UiNode = {
    kind: "component",
    name: "Button",
    attrs: [
      { kind: "static", name: "type", value: "submit" },
      { kind: "static", name: "label", value: spec.submit },
    ],
    children: [],
  };

  const component: Component = {
    name: pascalCase(form.slug),
    doc: [`Generated from vow "${form.slug}" (a form over the "${spec.of}" entity). Do not edit.`],
    imports,
    setup,
    view: {
      kind: "element",
      tag: "form",
      attrs: [
        { kind: "static", name: "class", value: "vow-form" },
        { kind: "event", name: "submit", expr: "submit", modifiers: ["prevent"] },
      ],
      children: [...fields.map(formField), submitButton],
    },
  };
  return renderVueSfc(component);
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

/**
 * Map raw props (every key but `children`) to bound attrs: numbers stay numbers, else string literals.
 * The reserved `model:` key becomes a two-way binding (`v-model="<expr>"`) — its value is the expression.
 */
function propsToAttrs(value: Record<string, unknown>): Attr[] {
  return Object.entries(value)
    .filter(([k]) => k !== "children")
    .map(
      ([name, v]): Attr =>
        name === "model"
          ? { kind: "model", expr: String(v) }
          : bound(name, typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "\\'")}'`),
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
  if (PRIMITIVES.includes(pascalCase(type))) {
    // a UI primitive placed directly in a view (e.g. `- button: { variant: outline, label: Save }`)
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

/** The primitives a `## view` references directly — so the plugin can materialise each adapter on demand. */
export function referencedPrimitives(view: Vow, entities: readonly string[] = []): string[] {
  if (!view.view) return [];
  const acc = new Set<string>();
  for (const vn of view.view) componentsIn(mapNode(vn.type, vn.value, entities), acc);
  return [...acc].filter((n) => PRIMITIVES.includes(n));
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
    `import type { Component } from "vue";`,
    `import { createRouter, type Route } from "@vow/router";`,
    `import ${name} from "./${rootSlug}.vue";`,
  ];
  if (theme) lines.push(`import "${theme}";`);
  lines.push(
    ``,
    `// Optional routes + chrome an extension (e.g. @vow/docs) may contribute, by the *.routes.ts /`,
    `// *.layout.vue convention — empty maps when there are none. The boot names no specific extension.`,
    `const fragments = import.meta.glob<{ routes?: Route[] }>("./*.routes.ts", { eager: true });`,
    `const docRoutes = Object.values(fragments).flatMap((m) => m.routes ?? []);`,
    `const layouts = import.meta.glob<{ default: Component }>("./*.layout.vue", { eager: true });`,
    `const layout = Object.values(layouts)[0]?.default;`,
    ``,
    `const routes: Route[] = [`,
    `  { path: "/", load: async () => ({ default: ${name} }) },`,
    `  ...docRoutes,`,
    `];`,
    ``,
    `createRouter(routes, { layout }).mount("#app");`,
    ``,
  );
  return lines.join("\n");
}

/** Ambient `*.vue` / `*.css` shims the generated boot needs for tsgo — written into `.generated/`. */
export const VOW_ENV_DTS = [
  `/// <reference types="vite/client" />`,
  `/** SFC + CSS shims so tsgo accepts .vue / .css imports (Volar/vue-tsc give the deep check). */`,
  `declare module "*.vue" {`,
  `  import type { DefineComponent } from "vue";`,
  `  const component: DefineComponent;`,
  `  export default component;`,
  `}`,
  `declare module "*.css";`,
  ``,
].join("\n");
