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
  const nativeFields = entity.fields.filter((f) => f.type !== "boolean"); // each gets a useId for its label
  const referenceFields = entity.fields.filter((f) => f.type === "reference");
  // a reference dropdown labels each target item by the target entity's first text field (else its id)
  const labelField = (ref?: string): string =>
    byId?.get(ref ?? "")?.fields.find((tf) => tf.type === "text")?.name ?? "id";

  const vueNames = ["ref"];
  if (nativeFields.length > 0) vueNames.push("useId");
  if (referenceFields.length > 0) vueNames.push("computed");

  const imports: ImportDecl[] = [
    { from: "vue", names: vueNames },
    { from: "zod", names: ["ZodError"] },
    { from: "@vow/store", names: ["useCollection"] },
    { from: `./${entity.slug}.ts`, names: [`create${type}`, `type ${type}`] },
    { from: "./Field.vue", default: "Field" },
    { from: "./Button.vue", default: "Button" },
    // the Table primitive — composed (not a primitive itself); the list is a composition over the parts
    { from: "./Table.vue", default: "Table" },
    { from: "./TableRow.vue", default: "TableRow" },
    { from: "./TableHead.vue", default: "TableHead" },
    { from: "./TableCell.vue", default: "TableCell" },
  ];
  if (entity.fields.some((f) => f.type === "boolean")) {
    imports.push({ from: "./Checkbox.vue", default: "Checkbox" });
  }
  if (entity.fields.some((f) => f.type === "select" || f.type === "reference")) {
    imports.push({ from: "./Select.vue", default: "Select" });
  }
  if (entity.fields.some((f) => f.type === "select")) {
    imports.push({ from: "./Badge.vue", default: "Badge" }); // a select value renders as a status chip
  }

  const setup: string[] = [
    // the shared store holds the items (one array per slug) — so a reference field can read another
    // entity's items; the local `ref`-per-view is gone
    `const { items: rows, append, removeAt } = useCollection<${type}>(${JSON.stringify(entity.slug)});`,
    `const draft = ref<Partial<${type}>>({});`,
    `const errors = ref<Record<string, string>>({});`,
  ];
  for (const f of nativeFields) setup.push(`const ${f.name}Id = useId();`);
  // a reference dropdown reads the target entity's shared collection, mapped to Select {value,label};
  // `${f.name}Name` resolves a stored id to the target's display name (referent-display) for the list cell
  for (const f of referenceFields) {
    setup.push(
      `const ${f.name}Options = useCollection<{ id: string } & Record<string, unknown>>(${JSON.stringify(f.ref ?? "")}).items;`,
      `const ${f.name}Choices = computed(() => ${f.name}Options.map((t) => ({ value: t.id, label: String(t.${labelField(f.ref)}) })));`,
      `const ${f.name}Name = (id: unknown): string => String(${f.name}Options.find((t) => t.id === id)?.${labelField(f.ref)} ?? id ?? "");`,
    );
  }
  setup.push(
    ``,
    // the create form validates with the entity's zod schema and surfaces per-field errors (no swallow)
    `function add(): void {`,
    `  try {`,
    `    append(create${type}(draft.value));`,
    `    draft.value = {};`,
    `    errors.value = {};`,
    `  } catch (err) {`,
    `    if (err instanceof ZodError) {`,
    `      errors.value = Object.fromEntries(err.issues.map((i) => [String(i.path[0]), i.message]));`,
    `    }`,
    `  }`,
    `}`,
    `function remove(index: number): void {`,
    `  removeAt(index);`,
    `}`,
  );

  // one display cell per field: boolean → <Checkbox>; reference → the target's resolved name (not its id);
  // select → a <Badge> status chip; everything else → the value. The <td> is the cell — no span wrapper.
  const cellContent = (f: Field): UiNode => {
    if (f.type === "boolean") {
      return {
        kind: "component",
        name: "Checkbox",
        attrs: [
          { kind: "model", expr: `item.${f.name}` },
          { kind: "static", name: "label", value: f.name },
        ],
        children: [],
      };
    }
    if (f.type === "reference") return { kind: "interp", expr: `${f.name}Name(item.${f.name})` };
    if (f.type === "select") {
      return {
        kind: "component",
        name: "Badge",
        attrs: [{ kind: "bound", name: "label", expr: `String(item.${f.name})` }],
        children: [],
      };
    }
    return { kind: "interp", expr: `item.${f.name}` };
  };

  const deleteButton: UiNode = {
    kind: "element",
    tag: "button",
    attrs: [
      { kind: "static", name: "class", value: "vow-view__delete" },
      { kind: "static", name: "type", value: "button" },
      {
        kind: "bound",
        name: "aria-label",
        expr: `'Delete: ' + item.${nativeFields[0]?.name ?? "title"}`,
      },
      { kind: "event", name: "click", expr: "remove(i)" },
    ],
    children: [{ kind: "text", text: "✕" }],
  };

  // the create form — the SAME labelled, zod-validated `<Field>` stack as a standalone `## form` (no
  // squished single row); a boolean self-labels as a `<Checkbox>`.
  const createForm: UiNode = {
    kind: "element",
    tag: "form",
    attrs: [
      { kind: "static", name: "class", value: "vow-form vow-view__create" },
      { kind: "event", name: "submit", expr: "add", modifiers: ["prevent"] },
    ],
    children: [
      ...entity.fields.map(formField),
      {
        kind: "component",
        name: "Button",
        attrs: [
          { kind: "static", name: "type", value: "submit" },
          { kind: "static", name: "label", value: "+ Add" },
        ],
        children: [],
      },
    ],
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
          kind: "component",
          name: "Table",
          attrs: [{ kind: "cond", type: "if", expr: "rows.length > 0" }],
          children: [
            {
              kind: "element",
              tag: "thead",
              attrs: [],
              children: [
                {
                  kind: "component",
                  name: "TableRow",
                  attrs: [],
                  children: [
                    ...entity.fields.map(
                      (f): UiNode => ({
                        kind: "component",
                        name: "TableHead",
                        attrs: [{ kind: "static", name: "scope", value: "col" }],
                        children: [{ kind: "text", text: f.name }],
                      }),
                    ),
                    {
                      kind: "component",
                      name: "TableHead",
                      attrs: [
                        { kind: "static", name: "scope", value: "col" },
                        { kind: "static", name: "aria-label", value: "Actions" },
                      ],
                      children: [],
                    },
                  ],
                },
              ],
            },
            {
              kind: "element",
              tag: "tbody",
              attrs: [],
              children: [
                {
                  kind: "component",
                  name: "TableRow",
                  attrs: [],
                  for: { each: "rows", as: "item", index: "i", key: "item.id" },
                  children: [
                    ...entity.fields.map(
                      (f): UiNode => ({
                        kind: "component",
                        name: "TableCell",
                        attrs: [{ kind: "static", name: "class", value: `field-${f.name}` }],
                        children: [cellContent(f)],
                      }),
                    ),
                    {
                      kind: "component",
                      name: "TableCell",
                      attrs: [{ kind: "static", name: "class", value: "vow-table__action" }],
                      children: [deleteButton],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          // when the collection is empty, a bare header is pointless — show a friendly empty state
          kind: "element",
          tag: "p",
          attrs: [
            { kind: "static", name: "class", value: "vow-empty" },
            { kind: "cond", type: "if", expr: "rows.length === 0" },
          ],
          children: [{ kind: "text", text: "Nothing here yet — add the first one below." }],
        },
        createForm,
      ],
    },
  };

  return renderVueSfc(component);
}

/** The PascalCase component name for an entity's list view (`task` → `Task`). */
export function viewComponentName(entity: Vow): string {
  return pascalCase(entity.slug);
}

/** The component name for an entity's counts-by-field stats (`task`,`status` → `TaskStatusStats`). */
export function statsComponentName(of: string, by: string): string {
  return pascalCase(of) + pascalCase(by) + "Stats";
}

/** The component name for an entity's card grid (`task` → `TaskCards`). */
export function cardsComponentName(of: string): string {
  return pascalCase(of) + "Cards";
}

/** The component name for an entity's kanban board (`task`,`status` → `TaskStatusBoard`). */
export function boardComponentName(of: string, by: string): string {
  return pascalCase(of) + pascalCase(by) + "Board";
}

/** The Card header + body for one record in a generated card/board view (title field → header, rest → body). */
function recordCard(entity: Vow, omit: readonly string[]): UiNode[] {
  const titleField =
    entity.fields.find((f) => f.type === "text" || f.type === "longtext") ?? entity.fields[0];
  const bodyFields = entity.fields.filter(
    (f) => f.name !== titleField?.name && !omit.includes(f.name),
  );
  const children: UiNode[] = [];
  if (titleField !== undefined) {
    children.push(comp("CardHeader", [], [{ kind: "interp", expr: `item.${titleField.name}` }]));
  }
  if (bodyFields.length > 0) {
    children.push(
      comp(
        "CardBody",
        [],
        bodyFields.map(
          (f): UiNode => ({
            kind: "element",
            tag: "p",
            attrs: [{ kind: "static", name: "class", value: "vow-card__field" }],
            children: [
              {
                kind: "element",
                tag: "strong",
                attrs: [],
                children: [{ kind: "text", text: `${f.name}: ` }],
              },
              { kind: "interp", expr: `item.${f.name}` },
            ],
          }),
        ),
      ),
    );
  }
  return children;
}

/**
 * A stats composition over an entity — one `<Stat>` per option of a `select` field, counting the rows
 * in that group (live from the shared store). A composition, not a primitive: it knows the entity's
 * field + binds the store; it composes the `Stats`/`Stat` primitives.
 */
export function emitEntityStats(entity: Vow, by: string): string {
  if (entity.fulfills?.kind !== "emit" || entity.fulfills.as !== "entity") {
    throw new Error(`emit-view: \`stats\` target "${entity.slug}" must be an \`emit entity\``);
  }
  const field = entity.fields.find((f) => f.name === by);
  if (field === undefined || field.type !== "select") {
    throw new Error(
      `emit-view: \`stats: { by: ${by} }\` must reference a select field of "${entity.slug}"`,
    );
  }
  const type = pascalCase(entity.slug);
  const component: Component = {
    name: statsComponentName(entity.slug, by),
    doc: [
      `Generated from vow "${entity.slug}" — a count of rows per ${by}. The vow is the source — do not edit.`,
    ],
    imports: [
      { from: "vue", names: ["computed"] },
      { from: "@vow/store", names: ["useCollection"] },
      { from: `./${entity.slug}.ts`, names: [`type ${type}`] },
      { from: "./Stats.vue", default: "Stats" },
      { from: "./Stat.vue", default: "Stat" },
    ],
    setup: [
      `const { items: rows } = useCollection<${type}>(${JSON.stringify(entity.slug)});`,
      `const options = ${JSON.stringify(field.options ?? [])};`,
      `const stats = computed(() =>`,
      `  options.map((o) => ({ label: o, value: rows.filter((r) => r.${by} === o).length })),`,
      `);`,
    ],
    view: {
      kind: "component",
      name: "Stats",
      attrs: [],
      children: [
        {
          kind: "component",
          name: "Stat",
          for: { each: "stats", as: "s", key: "s.label" },
          attrs: [
            { kind: "bound", name: "value", expr: "s.value" },
            { kind: "bound", name: "label", expr: "s.label" },
          ],
          children: [],
        },
      ],
    },
  };
  return renderVueSfc(component);
}

/**
 * A cards composition over an entity — one `<Card>` per record (live from the shared store): its first
 * text field titles the card, the rest fill the body. A composition, not a primitive: it knows the
 * entity's fields + binds the store; it composes the `Card`/`CardHeader`/`CardBody` primitives in a Grid.
 */
export function emitEntityCards(entity: Vow): string {
  if (entity.fulfills?.kind !== "emit" || entity.fulfills.as !== "entity") {
    throw new Error(`emit-view: \`cards\` target "${entity.slug}" must be an \`emit entity\``);
  }
  const type = pascalCase(entity.slug);
  const cardChildren = recordCard(entity, []);
  const component: Component = {
    name: cardsComponentName(entity.slug),
    doc: [
      `Generated from vow "${entity.slug}" — a card per record. The vow is the source — do not edit.`,
    ],
    imports: [
      { from: "@vow/store", names: ["useCollection"] },
      { from: `./${entity.slug}.ts`, names: [`type ${type}`] },
      { from: "./Grid.vue", default: "Grid" },
      { from: "./Card.vue", default: "Card" },
      { from: "./CardHeader.vue", default: "CardHeader" },
      { from: "./CardBody.vue", default: "CardBody" },
    ],
    setup: [`const { items: rows } = useCollection<${type}>(${JSON.stringify(entity.slug)});`],
    view: {
      kind: "component",
      name: "Grid",
      attrs: [bound("columns", "3"), bound("gap", "4")],
      children: [
        {
          kind: "component",
          name: "Card",
          for: { each: "rows", as: "item", key: "item.id" },
          attrs: [],
          children: cardChildren,
        },
      ],
    },
  };
  return renderVueSfc(component);
}

/**
 * A kanban board over an entity — a column per option of a `select` field, the records grouped into
 * their column (live from the store); dragging a card to another column writes that field back. A
 * composition: it knows the entity's field + binds the store; it composes the Card primitives.
 */
export function emitEntityBoard(entity: Vow, by: string): string {
  if (entity.fulfills?.kind !== "emit" || entity.fulfills.as !== "entity") {
    throw new Error(`emit-view: \`board\` target "${entity.slug}" must be an \`emit entity\``);
  }
  const field = entity.fields.find((f) => f.name === by);
  if (field === undefined || field.type !== "select") {
    throw new Error(
      `emit-view: \`board: { by: ${by} }\` must reference a select field of "${entity.slug}"`,
    );
  }
  const type = pascalCase(entity.slug);
  const component: Component = {
    name: boardComponentName(entity.slug, by),
    doc: [
      `Generated from vow "${entity.slug}" — a kanban of records by ${by}. The vow is the source — do not edit.`,
    ],
    imports: [
      { from: "vue", names: ["computed", "ref"] },
      { from: "@vow/store", names: ["useCollection"] },
      { from: `./${entity.slug}.ts`, names: [`type ${type}`] },
      { from: "./Card.vue", default: "Card" },
      { from: "./CardHeader.vue", default: "CardHeader" },
      { from: "./CardBody.vue", default: "CardBody" },
    ],
    setup: [
      `const { items: rows } = useCollection<${type}>(${JSON.stringify(entity.slug)});`,
      `const options = ${JSON.stringify(field.options ?? [])};`,
      `const columns = computed(() =>`,
      `  options.map((o) => ({ option: o, cards: rows.filter((r) => r.${by} === o) })),`,
      `);`,
      `const dragged = ref<${type} | null>(null);`,
      `function onDrop(option: string): void {`,
      `  if (dragged.value) dragged.value.${by} = option as ${type}[${JSON.stringify(by)}];`,
      `  dragged.value = null;`,
      `}`,
    ],
    view: {
      kind: "element",
      tag: "div",
      attrs: [{ kind: "static", name: "class", value: "vow-board" }],
      children: [
        {
          kind: "element",
          tag: "div",
          attrs: [
            { kind: "static", name: "class", value: "vow-board__col" },
            { kind: "event", name: "dragover", expr: "", modifiers: ["prevent"] },
            { kind: "event", name: "drop", expr: "onDrop(col.option)" },
          ],
          for: { each: "columns", as: "col", key: "col.option" },
          children: [
            {
              kind: "element",
              tag: "div",
              attrs: [{ kind: "static", name: "class", value: "vow-board__col-head" }],
              children: [
                { kind: "interp", expr: "col.option" },
                {
                  kind: "element",
                  tag: "span",
                  attrs: [{ kind: "static", name: "class", value: "vow-board__count" }],
                  children: [{ kind: "interp", expr: "col.cards.length" }],
                },
              ],
            },
            {
              kind: "component",
              name: "Card",
              for: { each: "col.cards", as: "item", key: "item.id" },
              attrs: [
                { kind: "static", name: "class", value: "vow-board__card" },
                { kind: "static", name: "draggable", value: "true" },
                { kind: "event", name: "dragstart", expr: "dragged = item" },
              ],
              children: recordCard(entity, [by]),
            },
          ],
        },
      ],
    },
  };
  return renderVueSfc(component);
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
    if (o["eyebrow"] !== undefined)
      kids.push({
        kind: "element",
        tag: "span",
        attrs: [{ kind: "static", name: "class", value: "vow-eyebrow" }],
        children: [txt(str(o["eyebrow"]))],
      });
    if (o["title"] !== undefined) kids.push(el("h1", [txt(str(o["title"]))]));
    if (o["lead"] !== undefined) kids.push(el("p", [txt(str(o["lead"]))]));
    return comp("Flex", [bound("direction", "'column'"), bound("gap", "3")], kids);
  }
  if (type === "features") {
    // a responsive grid of vow's own Card primitive — title → CardHeader, body → CardBody
    const cards = (Array.isArray(value) ? value : []).map((it) => {
      const o = asObject(it);
      const inner: UiNode[] = [];
      if (o["title"] !== undefined) inner.push(comp("CardHeader", [], [txt(str(o["title"]))]));
      if (o["body"] !== undefined) inner.push(comp("CardBody", [], [txt(str(o["body"]))]));
      return comp("Card", [], inner);
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
  if (type === "cards") {
    const slug = str(value);
    if (!entities.includes(slug)) {
      throw new Error(
        `emit-view: \`cards: ${slug}\` references an unknown entity (known: ${entities.join(", ") || "none"})`,
      );
    }
    return comp(cardsComponentName(slug), [], []);
  }
  if (type === "stats") {
    // `stats: { of: <entity>, by: <select field> }` → the entity's counts-by-field composition
    const o = asObject(value);
    const of = str(o["of"]);
    const by = str(o["by"]);
    if (!entities.includes(of)) {
      throw new Error(
        `emit-view: \`stats: { of: ${of} }\` references an unknown entity (known: ${entities.join(", ") || "none"})`,
      );
    }
    return comp(statsComponentName(of, by), [], []);
  }
  if (type === "board") {
    // `board: { of: <entity>, by: <select field> }` → the entity's kanban composition
    const o = asObject(value);
    const of = str(o["of"]);
    const by = str(o["by"]);
    if (!entities.includes(of)) {
      throw new Error(
        `emit-view: \`board: { of: ${of} }\` references an unknown entity (known: ${entities.join(", ") || "none"})`,
      );
    }
    return comp(boardComponentName(of, by), [], []);
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
  if (type === "icon") {
    // a swappable @vow/icons glyph, by semantic name: `- icon: { name: search }`
    const o = asObject(value);
    return comp("Icon", [{ kind: "static", name: "name", value: str(o["name"]) }], []);
  }
  if (type === "link") {
    // an internal link the router intercepts (no full reload): `- link: { to: /add-task, label: …, icon? }`
    const o = asObject(value);
    const children: UiNode[] = [];
    if (o["icon"] !== undefined)
      children.push(comp("Icon", [{ kind: "static", name: "name", value: str(o["icon"]) }], []));
    children.push(txt(str(o["label"] ?? o["to"])));
    return {
      kind: "element",
      tag: "a",
      attrs: [
        { kind: "static", name: "class", value: "vow-link" },
        { kind: "static", name: "href", value: str(o["to"]) },
      ],
      children,
    };
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
    from: name === "Icon" ? "@vow/icons/Icon.vue" : `./${name}.vue`,
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
    from: name === "Icon" ? "@vow/icons/Icon.vue" : `./${name}.vue`,
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

/** The `stats: { of, by }` references a `## view` makes — so the plugin can emit each composition. */
export function statsRefs(view: Vow): { of: string; by: string }[] {
  const found: { of: string; by: string }[] = [];
  const seen = new Set<string>();
  const walk = (type: string, value: unknown): void => {
    if (type === "stats") {
      const o = asObject(value);
      const ref = { of: str(o["of"]), by: str(o["by"]) };
      const key = `${ref.of}.${ref.by}`;
      if (!seen.has(key)) {
        seen.add(key);
        found.push(ref);
      }
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
  return found;
}

/** The `cards: <entity>` references a `## view` makes — so the plugin can emit each composition. */
export function cardsRefs(view: Vow): string[] {
  const found = new Set<string>();
  const walk = (type: string, value: unknown): void => {
    if (type === "cards") {
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

/** The `board: { of, by }` references a `## view` makes — so the plugin can emit each composition. */
export function boardRefs(view: Vow): { of: string; by: string }[] {
  const found: { of: string; by: string }[] = [];
  const seen = new Set<string>();
  const walk = (type: string, value: unknown): void => {
    if (type === "board") {
      const o = asObject(value);
      const ref = { of: str(o["of"]), by: str(o["by"]) };
      const key = `${ref.of}.${ref.by}`;
      if (!seen.has(key)) {
        seen.add(key);
        found.push(ref);
      }
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
  return found;
}

/**
 * The app's route table for non-root pages — every `emit view` / `emit form` vow that isn't the root
 * becomes a route at `/<slug>`, lazily loading its `.vue`. Written as a `*.routes.ts` the boot globs (the
 * same seam @vow/docs uses), so the root page stays `/` and these join it — no hand-written router.
 */
export function emitAppRoutes(pages: readonly { slug: string; title: string }[]): string {
  return [
    `// Generated routes for the app's pages (views + forms). The vow tree is the source — do not edit.`,
    `import type { Route } from "@vow/router";`,
    ``,
    `export const routes: Route[] = [`,
    ...pages.map(
      (p) =>
        `  { path: "/${p.slug}", load: () => import("./${p.slug}.vue"), title: ${JSON.stringify(p.title)} },`,
    ),
    `];`,
    ``,
  ].join("\n");
}

/**
 * The app's shared chrome — a thin `*.layout.vue` (the boot globs it, the same seam @vow/docs uses) that
 * wraps every routed page in `@vow/shell`'s dashboard `Shell.vue`, passing the routed `pages`, the current
 * `path` (active link) and the app `title`. The chrome itself is the swappable `@vow/shell` layer; this is
 * only the generated wiring. Emitted only when the app has more than the home page.
 */
export function emitAppLayout(
  pages: readonly {
    slug: string;
    title: string;
    icon?: string;
    order?: number;
    group?: string;
  }[],
  title?: string,
  shell?: { nav?: string; width?: string; variant?: string },
): string {
  // Each page becomes a `Page` literal for the shell's sidebar — icon/group/order only when declared.
  const navPages = pages
    .map((p) => {
      const parts = [`path: "/${p.slug}"`, `title: ${JSON.stringify(p.title)}`];
      if (p.icon !== undefined) parts.push(`icon: ${JSON.stringify(p.icon)}`);
      if (p.group !== undefined) parts.push(`group: ${JSON.stringify(p.group)}`);
      if (p.order !== undefined) parts.push(`order: ${p.order}`);
      return `{ ${parts.join(", ")} }`;
    })
    .join(", ");
  // <Shell> always gets pages + path; title + the shell layout (nav · width · variant) only when declared.
  const decls = [`const pages = [${navPages}];`];
  const attrs = [`:pages="pages"`, `:path="path"`];
  const bind = (name: string, value: string | undefined): void => {
    if (value === undefined) return;
    decls.push(`const ${name} = ${JSON.stringify(value)};`);
    attrs.push(`:${name}="${name}"`);
  };
  bind("title", title);
  bind("nav", shell?.nav);
  bind("width", shell?.width);
  bind("variant", shell?.variant);
  return [
    `<script setup lang="ts">`,
    `// Generated app chrome — wraps every page in @vow/shell. The vow tree is the source — do not edit.`,
    `import Shell from "@vow/shell/Shell.vue";`,
    `import "@vow/shell/style.css";`,
    `defineProps<{ path: string }>();`,
    ...decls,
    `</script>`,
    ``,
    `<template>`,
    `  <Shell ${attrs.join(" ")}><slot /></Shell>`,
    `</template>`,
    ``,
  ].join("\n");
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
    `void createRouter(routes, { layout }).mount("#app");`,
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
