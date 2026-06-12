import type { Component, ImportDecl, ReadonlyField, ReadonlyVow, UiNode } from "./types.ts";
import { FIELD_KINDS, defined, isEmitEntity } from "@vow/core";
import { humanizeFieldName, pascalCase, renderVueSfc } from "@vow/component";
import type { EntityLookup } from "./lookup.ts";
import { contextAttrs } from "./button-intent.ts";
import { fieldControl } from "./field-control.ts";

/** Whether a field self-labels as a `<Checkbox>` (its registered control) rather than a labelled `<Field>`. */
function isCheckbox(field: ReadonlyField): boolean {
  return FIELD_KINDS[field.type].control === "checkbox";
}

/** Whether a field renders through vow's `<Select>` primitive (a fixed list or a reference's collection). */
function isSelect(field: ReadonlyField): boolean {
  return FIELD_KINDS[field.type].control === "select";
}

/** A live `role="alert"` error paragraph for a field, shown only when `errors.<name>` is set. */
function errorNode(name: string): UiNode {
  return {
    attrs: [
      { kind: "static", name: "class", value: "vow-field__error" },
      { kind: "static", name: "role", value: "alert" },
      { expr: `errors.${name}`, kind: "cond", type: "if" },
    ],
    children: [{ expr: `errors.${name}`, kind: "interp" }],
    kind: "element",
    tag: "p",
  };
}

/**
 * Wire a control to its field. A native element takes the shared id (so the `<label for>` lines up),
 * aria-describedby and aria-invalid. A Select component takes the same id as `control-id`, which it forwards
 * to its trigger — so the label's `for` points at the real combobox (click-to-focus + association) — plus
 * `described-by` + `invalid`, which it forwards as the trigger's aria-describedby + aria-invalid.
 */
function withControlId(control: UiNode, name: string): UiNode {
  if (control.kind === "component") {
    return {
      ...control,
      attrs: [
        ...control.attrs,
        { expr: `${name}Id`, kind: "bound", name: "control-id" },
        { expr: `${name}Id + '-error'`, kind: "bound", name: "described-by" },
        { expr: `!!errors.${name}`, kind: "bound", name: "invalid" },
      ],
    };
  }
  if (control.kind !== "element") {
    return control;
  }
  return {
    ...control,
    attrs: [
      ...control.attrs,
      { expr: `${name}Id`, kind: "bound", name: "id" },
      { expr: `${name}Id + '-error'`, kind: "bound", name: "aria-describedby" },
      { expr: `!!errors.${name}`, kind: "bound", name: "aria-invalid" },
    ],
  };
}

/** A boolean field — a `<Checkbox>` plus its error node. */
function booleanField(field: ReadonlyField): UiNode {
  return {
    attrs: [{ kind: "static", name: "class", value: "vow-field" }],
    children: [
      {
        attrs: [
          { expr: `draft.${field.name}`, kind: "model" },
          { kind: "static", name: "label", value: humanizeFieldName(field.name) },
        ],
        children: [],
        kind: "component",
        name: "Checkbox",
      },
      errorNode(field.name),
    ],
    kind: "element",
    tag: "div",
  };
}

/** A `<Select>`'s placeholder — the unselected-trigger copy, the humanized field name (the inputs'
 *  `placeholder="<field>"` convention applied to vow's Select primitive). */
function withSelectPlaceholder(control: UiNode, field: ReadonlyField): UiNode {
  if (control.kind !== "component" || !isSelect(field)) {
    return control;
  }
  return {
    ...control,
    attrs: [
      ...control.attrs,
      { kind: "static", name: "placeholder", value: humanizeFieldName(field.name) },
    ],
  };
}

/** One field in a form: a boolean self-labels as a `<Checkbox>`; everything else is a labelled `<Field>`. */
function formField(field: ReadonlyField): UiNode {
  if (isCheckbox(field)) {
    return booleanField(field);
  }
  const control = withSelectPlaceholder(fieldControl(field, `draft.${field.name}`), field);
  return {
    attrs: [
      { kind: "static", name: "label", value: humanizeFieldName(field.name) },
      { expr: `${field.name}Id`, kind: "bound", name: "control-id" },
      { expr: `errors.${field.name}`, kind: "bound", name: "error" },
    ],
    children: [withControlId(control, field.name)],
    kind: "component",
    name: "Field",
  };
}

/** The resolved entity a form is bound to — throws when the `of:` target is missing or not an entity. */
function formEntity(form: ReadonlyVow, byId: EntityLookup): ReadonlyVow {
  const target = form.form?.of;
  if (!defined(target) || target.length === 0) {
    throw new Error(`emit-view: "${form.slug}" needs a \`## form\` with \`of: <entity>\``);
  }
  const entity = byId.get(target);
  if (!defined(entity) || !isEmitEntity(entity)) {
    throw new Error(`emit-view: "${form.slug}" form \`of: ${target}\` is not a known entity`);
  }
  return entity;
}

/** The label field a reference resolves its target by (first text field, else id). */
function referenceLabel(byId: EntityLookup): (ref?: string) => string {
  return (ref?: string): string =>
    byId.get(ref ?? "")?.fields.find((field) => field.type === "text")?.name ?? "id";
}

/** The control adapters a form's fields pull in (`<Checkbox>` for booleans, `<Select>` for select/ref) —
 *  derived from each field's registered control, so the imports track `fieldControl` exactly. */
function controlImports(entity: ReadonlyVow): ImportDecl[] {
  const imports: ImportDecl[] = [];
  if (entity.fields.some((field) => isCheckbox(field))) {
    imports.push({ default: "Checkbox", from: "./Checkbox.vue" });
  }
  if (entity.fields.some((field) => isSelect(field))) {
    imports.push({ default: "Select", from: "./Select.vue" });
  }
  return imports;
}

/** The vue named imports a form needs — `computed`/`watch` come in only for the edit/singleton mode. */
function vueImportNames(entity: ReadonlyVow, edit: boolean): string[] {
  const names = ["ref", "useId"];
  if (edit || entity.fields.some((field) => field.type === "reference")) {
    names.push("computed");
  }
  if (edit) {
    names.push("watch");
  }
  return names;
}

/** The form's imports — vue, zod, the entity factory + type, the store, and the used controls. */
function formImports(entity: ReadonlyVow, edit: boolean): ImportDecl[] {
  const name = pascalCase(entity.slug);
  return [
    { from: "vue", names: vueImportNames(entity, edit) },
    { from: "zod", names: ["ZodError"] },
    { from: `./${entity.slug}.ts`, names: [`create${name}`, `type ${name}`] },
    { from: "@vow/store", names: ["useCollection"] },
    { default: "Field", from: "./Field.vue" },
    { default: "Button", from: "./Button.vue" },
    ...controlImports(entity),
  ];
}

/** A create-form submit — validate via the zod factory, append a new record, clear the draft. */
function appendSubmit(name: string): string[] {
  return [
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
  ];
}

/** An edit-form submit — validate, update the loaded row in place (id kept), flash a transient "Saved". */
function updateSubmit(name: string): string[] {
  return [
    ``,
    `function submit(): void {`,
    `  const row = current.value;`,
    `  if (row === undefined) {`,
    `    return;`,
    `  }`,
    `  try {`,
    `    update(row.id, create${name}({ ...draft.value, id: row.id }));`,
    `    errors.value = {};`,
    `    saved.value = true;`,
    `    setTimeout(() => {`,
    `      saved.value = false;`,
    `    }, 2000);`,
    `  } catch (err) {`,
    `    if (err instanceof ZodError) {`,
    `      errors.value = Object.fromEntries(err.issues.map((i) => [String(i.path[0]), i.message]));`,
    `    }`,
    `  }`,
    `}`,
  ];
}

/** The store binding + extra refs the edit mode adds — the loaded row, a `saved` flag, a refill watch. */
function editSetup(name: string, slug: string): string[] {
  return [
    `const { items, update } = useCollection<${name}>(${JSON.stringify(slug)});`,
    `const draft = ref<Partial<${name}>>({});`,
    `const errors = ref<Record<string, string>>({});`,
    `const saved = ref(false);`,
    `const current = computed<${name} | undefined>(() => items[0]);`,
    `watch(`,
    `  current,`,
    `  (row) => {`,
    `    if (row !== undefined) {`,
    `      draft.value = { ...row };`,
    `    }`,
    `  },`,
    `  { immediate: true },`,
    `);`,
  ];
}

/** The store binding + base refs the create mode adds. */
function createSetup(name: string, slug: string): string[] {
  return [
    `const { append } = useCollection<${name}>(${JSON.stringify(slug)});`,
    `const draft = ref<Partial<${name}>>({});`,
    `const errors = ref<Record<string, string>>({});`,
  ];
}

/** The store binding + refs for the mode — an edit form loads + tracks its singleton; a create form appends. */
function storeSetup(name: string, slug: string, edit: boolean): string[] {
  if (edit) {
    return editSetup(name, slug);
  }
  return createSetup(name, slug);
}

/** The submit handler for the mode — `update` in edit mode, `append` in create mode. */
function submitLines(name: string, edit: boolean): string[] {
  if (edit) {
    return updateSubmit(name);
  }
  return appendSubmit(name);
}

/** A `useId` per labelled (non-checkbox) field, plus the choice computeds each reference field needs. */
function fieldSetup(entity: ReadonlyVow, label: (ref?: string) => string): string[] {
  const setup: string[] = [];
  for (const field of entity.fields.filter((candidate) => !isCheckbox(candidate))) {
    setup.push(`const ${field.name}Id = useId();`);
  }
  for (const field of entity.fields.filter((candidate) => candidate.type === "reference")) {
    setup.push(
      `const ${field.name}Options = useCollection<{ id: string } & Record<string, unknown>>(${JSON.stringify(field.ref ?? "")}).items;`,
      `const ${field.name}Choices = computed(() => ${field.name}Options.map((t) => ({ value: t.id, label: String(t.${label(field.ref)}) })));`,
    );
  }
  return setup;
}

/** The form's setup — store binding + refs, a useId per native field, reference computeds, the submit. */
function formSetup(entity: ReadonlyVow, edit: boolean, label: (ref?: string) => string): string[] {
  const name = pascalCase(entity.slug);
  return [
    ...storeSetup(name, entity.slug, edit),
    ...fieldSetup(entity, label),
    ...submitLines(name, edit),
  ];
}

/** The submit button — labelled by the `## form`'s `submit:`. */
function submitButton(form: ReadonlyVow): UiNode {
  return {
    attrs: [
      { kind: "static", name: "type", value: "submit" },
      { kind: "static", name: "label", value: form.form?.submit ?? "" },
      ...contextAttrs("form-footer"),
    ],
    children: [],
    kind: "component",
    name: "Button",
  };
}

/** A live `role="status"` confirmation, shown for a moment after an edit-mode save (the `saved` flag). */
function savedNode(): UiNode {
  return {
    attrs: [
      { kind: "static", name: "class", value: "vow-form__saved" },
      { kind: "static", name: "role", value: "status" },
      { expr: "saved", kind: "cond", type: "if" },
    ],
    children: [{ kind: "text", text: "Saved" }],
    kind: "element",
    tag: "p",
  };
}

/** The trailing controls — the submit button, plus a transient "Saved" status in edit mode. */
function formControls(form: ReadonlyVow, edit: boolean): UiNode[] {
  if (edit) {
    return [submitButton(form), savedNode()];
  }
  return [submitButton(form)];
}

/**
 * A form from a `## form` (an `emit form` vow), bound to an entity via `of:`. Each entity field renders
 * as a labelled `<Field>` (a boolean self-labels as `<Checkbox>`); on submit it validates with the
 * entity's zod schema (via `create<Name>`) and surfaces the per-field errors. `byId` resolves the bound
 * entity and any reference targets.
 */
export function emitForm(form: ReadonlyVow, byId: EntityLookup): string {
  const entity = formEntity(form, byId);
  const edit = form.form?.edit === true;
  const fields: UiNode[] = entity.fields.map((field) => formField(field));
  const component: Component = {
    doc: [
      `Generated from vow "${form.slug}" (a form over the "${entity.slug}" entity). Do not edit.`,
    ],
    imports: formImports(entity, edit),
    name: pascalCase(form.slug),
    setup: formSetup(entity, edit, referenceLabel(byId)),
    view: {
      attrs: [
        { kind: "static", name: "class", value: "vow-form" },
        { expr: "submit", kind: "event", modifiers: ["prevent"], name: "submit" },
      ],
      children: [...fields, ...formControls(form, edit)],
      kind: "element",
      tag: "form",
    },
  };
  return renderVueSfc(component);
}
