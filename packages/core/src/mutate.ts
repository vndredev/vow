import { NONE, defined } from "./guard.ts";
import { SUFFIX, loadVows, validateReferences } from "./load.ts";
import { existsSync, rmSync } from "node:fs";
import { isEmit, isEmitEntity } from "./fulfillment.ts";
import type { ReadonlyVow } from "./readonly.ts";
import { Vow } from "./vow.ts";
import path from "node:path";
import { writeVow } from "./serialize.ts";

/**
 * The structure mutations — the typed authoring API over the vow tree (`@vow/core`'s write side, built on
 * `loadVows` + `serialize`/`writeVow`). Each loads the tree, mutates one vow in memory, **validates the
 * whole tree** (`Vow.parse` + `validateReferences`) before writing, then writes just that vow's `.md` — so
 * a running `vp dev` regenerates. Data (records) is NOT here — that's `@vow/db`'s CRUD; `@vow/mcp` composes
 * the two. No separate `@vow/author` package: authoring the tree is the same concern as parsing it.
 */

/** A field on an entity vow, read-only to its leaves (the create/mutate input shape). */
type Field = ReadonlyVow["fields"][number];
/** A view node, read-only to its leaves (the page-building input shape). */
type ViewNode = NonNullable<ReadonlyVow["view"]>[number];
/** A seed record, read-only to its leaves (the `## seed` input shape). */
type SeedRecord = NonNullable<ReadonlyVow["seed"]>[number];
/**
 * A field patch — every key the LLM may edit in place (rename · retype · toggle required · edit the
 * select options / reference target). An omitted key keeps its current value; a present key overwrites.
 * Each key carries `| undefined` so an all-optional caller (the MCP studio) is assignable under
 * `exactOptionalPropertyTypes`.
 */
interface FieldPatch {
  readonly name?: string | undefined;
  readonly options?: readonly string[] | undefined;
  readonly ref?: string | undefined;
  readonly required?: boolean | undefined;
  readonly type?: Field["type"] | undefined;
}
/** A draft vow — a readonly structure passed to `Vow.parse` (which validates and freezes the shape). */
type Draft = Omit<ReadonlyVow, "children" | "id">;
/** A vow's nav entry — label · icon · order · group (the surface `setNav` patches). */
type Nav = NonNullable<ReadonlyVow["nav"]>;
/** A nav entry that may be absent — the stored shape (`ReadonlyVow["nav"]`). */
type MaybeNav = ReadonlyVow["nav"];
/**
 * A nav patch: each key may carry a new value or `null` (the unset sentinel — drop the key), the whole
 * patch may be `null` (clear the entry), and an absent patch is a no-op. The complete inverse of every
 * nav field the LLM can set.
 */
type NavPatch = null | undefined | { readonly [Key in keyof Nav]?: Nav[Key] | null };

/** A stable id from a slug — `vow_<slug without hyphens>` (the `^[a-z]+_[a-z0-9]+$` shape). */
function idFor(slug: string): string {
  return `vow_${slug.replaceAll("-", "")}`;
}

/** `updated` in place of the vow with `slug`, otherwise the original — the tree-rewrite step. */
function replaceOne(vow: ReadonlyVow, slug: string, updated: ReadonlyVow): ReadonlyVow {
  if (vow.slug === slug) {
    return updated;
  }
  return vow;
}

/** Replace the vow with `slug` in the tree, validate the whole tree, then write just that vow's file. */
function replace(appDir: string, slug: string, mutate: (vow: ReadonlyVow) => ReadonlyVow): Vow {
  const tree = loadVows(appDir);
  const target = tree.find((vow: ReadonlyVow) => vow.slug === slug);
  if (!target) {
    throw new Error(`mutate: no vow "${slug}" under ${appDir}`);
  }
  const updated = Vow.parse(mutate(target));
  validateReferences(tree.map((vow: ReadonlyVow) => replaceOne(vow, slug, updated)));
  writeVow(appDir, updated);
  return updated;
}

/** Create a vow with `slug` (must not exist), validate, write it. */
function create(appDir: string, draft: Draft): Vow {
  const tree = loadVows(appDir);
  const { slug } = draft;
  if (tree.some((vow: ReadonlyVow) => vow.slug === slug)) {
    throw new Error(`mutate: vow "${slug}" already exists`);
  }
  const vow = Vow.parse({ id: idFor(slug), ...draft });
  validateReferences([...tree, vow]);
  writeVow(appDir, vow);
  return vow;
}

/** Assert no two fields share a name — a duplicate is a silent second column/key in the entity. */
function assertFieldsUnique(action: string, slug: string, fields: readonly Field[]): void {
  const seen = new Set<string>();
  for (const field of fields) {
    if (seen.has(field.name)) {
      throw new Error(`${action}: "${slug}" already has a field "${field.name}"`);
    }
    seen.add(field.name);
  }
}

/** Assert a slug resolves to an `emit entity` — fields/forms over a view/form slug are inert. */
function assertEmitEntity(action: string, vow: ReadonlyVow): void {
  if (!isEmitEntity(vow)) {
    throw new Error(`${action}: "${vow.slug}" is not an entity`);
  }
}

/** Assert a slug resolves to an `emit form` — a `## form` block merged onto a view/entity slug is inert
 *  (the emitter is driven by `fulfills.as`), so editing one is a false success without this guard. */
function assertEmitForm(action: string, vow: ReadonlyVow): void {
  if (!isEmit(vow, "form")) {
    throw new Error(`${action}: "${vow.slug}" is not a form`);
  }
}

/** Add a new `emit entity` vow (a data model). */
export function addEntity(
  appDir: string,
  opts: { readonly slug: string; readonly intent: string; readonly fields?: readonly Field[] },
): Vow {
  const fields = opts.fields ?? [];
  assertFieldsUnique("add_entity", opts.slug, fields);
  return create(appDir, {
    fields,
    fulfills: { as: "entity", kind: "emit" },
    intent: opts.intent,
    proof: [],
    slug: opts.slug,
  });
}

/** Add a new `emit view` vow (a page built from a `## view`). */
export function addView(
  appDir: string,
  opts: {
    readonly slug: string;
    readonly intent: string;
    readonly view: readonly ViewNode[];
    readonly nav?: ReadonlyVow["nav"];
    readonly root?: boolean | undefined;
    readonly title?: string | undefined;
    readonly shell?: ReadonlyVow["shell"];
  },
): Vow {
  return create(appDir, {
    fields: [],
    fulfills: { as: "view", kind: "emit" },
    intent: opts.intent,
    nav: opts.nav,
    proof: [],
    root: opts.root,
    shell: opts.shell,
    slug: opts.slug,
    title: opts.title,
    view: opts.view,
  });
}

/**
 * Assert a form's `of:` target resolves to a known `emit entity` — synchronously, at the call, mirroring
 * `validateReferences` for reference fields (else a typo'd target defers a false-success to a build error).
 * The 4-arg shape (action, appDir, slug, of) carries the calling action so the throw names it (add_form /
 * set_form), like every other mutate guard.
 */
// eslint-disable-next-line max-params
function assertFormTarget(action: string, appDir: string, slug: string, of: string): void {
  const entities = loadVows(appDir).filter((vow: ReadonlyVow) => isEmitEntity(vow));
  if (!entities.some((vow: ReadonlyVow) => vow.slug === of)) {
    const known = entities.map((vow: ReadonlyVow) => vow.slug).join(", ");
    throw new Error(
      `${action}: form "${slug}" of: "${of}" is not a known entity — known: ${known}`,
    );
  }
}

/** Add a new `emit form` vow (a bound, validated `## form` over an entity). `edit: true` makes it a
 *  singleton editor — it pre-loads the entity's latest row and updates it in place. */
export function addForm(
  appDir: string,
  opts: {
    readonly slug: string;
    readonly intent: string;
    readonly of: string;
    readonly submit: string;
    readonly edit?: boolean | undefined;
    readonly nav?: ReadonlyVow["nav"];
  },
): Vow {
  assertFormTarget("add_form", appDir, opts.slug, opts.of);
  return create(appDir, {
    fields: [],
    form: { edit: opts.edit, of: opts.of, submit: opts.submit },
    fulfills: { as: "form", kind: "emit" },
    intent: opts.intent,
    nav: opts.nav,
    proof: [],
    slug: opts.slug,
  });
}

/** A form's current shape (the `## form` block), read-only to its leaves. */
type Form = NonNullable<ReadonlyVow["form"]>;
/**
 * A form patch — `of` (the bound entity), `submit` (the button label), `edit` (singleton-editor mode).
 * An omitted key keeps its current value; a present key overwrites. Each key carries `| undefined` so an
 * all-optional caller (the MCP studio) is assignable under `exactOptionalPropertyTypes`.
 */
interface FormPatch {
  readonly edit?: boolean | undefined;
  readonly of?: string | undefined;
  readonly submit?: string | undefined;
}

/** Merge a form patch over the existing block — an omitted key keeps its value, a present one overwrites. */
function mergeForm(form: Form | undefined, patch: FormPatch): Form {
  return {
    edit: patch.edit ?? form?.edit,
    of: patch.of ?? form?.of,
    submit: patch.submit ?? form?.submit ?? "Submit",
  };
}

/** Edit an `emit form`'s `of`/`submit`/`edit` in place. Rejects a non-form target (a `form` block on a
 *  view/entity is inert) and re-validates a changed `of` against the tree. */
export function setForm(appDir: string, slug: string, patch: FormPatch): Vow {
  if (defined(patch.of)) {
    assertFormTarget("set_form", appDir, slug, patch.of);
  }
  return replace(appDir, slug, (vow) => {
    assertEmitForm("set_form", vow);
    return { ...vow, form: mergeForm(vow.form, patch) };
  });
}

/** Add a field to an entity — rejects a non-entity target and a duplicate field name. */
export function addField(appDir: string, slug: string, field: Field): Vow {
  return replace(appDir, slug, (vow) => {
    assertEmitEntity("add_field", vow);
    const fields = [...vow.fields, field];
    assertFieldsUnique("add_field", slug, fields);
    return { ...vow, fields };
  });
}

/** Remove a field from an entity by name. */
export function removeField(appDir: string, slug: string, fieldName: string): Vow {
  return replace(appDir, slug, (vow) => ({
    ...vow,
    fields: vow.fields.filter((field) => field.name !== fieldName),
  }));
}

/** The `options`/`ref` carried by a patched field — kept only for the type that uses them, so a retype
 *  away from `select`/`reference` drops the now-meaningless value (the canonical shape `Field` validates). */
function typeBound(
  type: Field["type"],
  field: Field,
  patch: FieldPatch,
): { options?: readonly string[] | undefined; ref?: string | undefined } {
  if (type === "select") {
    return { options: patch.options ?? field.options };
  }
  if (type === "reference") {
    return { ref: patch.ref ?? field.ref };
  }
  return {};
}

/** Merge a field patch over an existing field — an omitted key keeps its value, a present one overwrites;
 *  `options`/`ref` survive only when the resulting type still uses them (else a retype strands them). */
function patchField(field: Field, patch: FieldPatch): Field {
  const type = patch.type ?? field.type;
  return {
    name: patch.name ?? field.name,
    required: patch.required ?? field.required,
    type,
    ...typeBound(type, field, patch),
  };
}

/**
 * Edit a field on an entity in place by name — rename, retype, toggle `required`, or edit the select
 * options / reference target. Rejects a non-entity target and a rename that collides with another field.
 * (The DB-column follow on a rename lives a layer up, in the studio — this writes only the vow.) The
 * 4-arg shape (appDir, slug, name, patch) is the seam every caller binds to — grouping would ripple.
 */
// eslint-disable-next-line max-params
export function setField(appDir: string, slug: string, name: string, patch: FieldPatch): Vow {
  return replace(appDir, slug, (vow) => {
    assertEmitEntity("set_field", vow);
    const fields = vow.fields.map((field) => {
      if (field.name === name) {
        return patchField(field, patch);
      }
      return field;
    });
    assertFieldsUnique("set_field", slug, fields);
    return { ...vow, fields };
  });
}

/** Replace an entity's versioned `## seed` records (the data that travels with the spec). */
export function setSeed(appDir: string, slug: string, seed: readonly SeedRecord[]): Vow {
  return replace(appDir, slug, (vow) => {
    assertEmitEntity("set_seed", vow);
    return { ...vow, seed };
  });
}

/** Replace a vow's `## view` (the page tree) in place — the inverse of `addView`'s `view`. */
export function setView(appDir: string, slug: string, view: readonly ViewNode[]): Vow {
  return replace(appDir, slug, (vow) => ({ ...vow, view }));
}

/** Set a vow's intent (the `# …` promise). */
export function setIntent(appDir: string, slug: string, intent: string): Vow {
  return replace(appDir, slug, (vow) => ({ ...vow, intent }));
}

/**
 * Resolve one nav key against a patch: a `null` patch value clears it (absence), a present value
 * overwrites, and an omitted key keeps its current value — the per-key shallow-merge with unset.
 */
function pickNav<Value>(
  current: Value | undefined,
  patch: Value | null | undefined,
): Value | undefined {
  if (patch === null) {
    return NONE;
  }
  if (defined(patch)) {
    return patch;
  }
  return current;
}

/**
 * Merge a nav patch over the existing entry: a `null` patch clears the whole entry; a `null` value per
 * key drops that key; any other value overwrites. Omitted keys keep their existing value (a shallow merge).
 * An entry with no surviving keys folds back to absence (no `nav:` line is written).
 */
function mergeNav(current: MaybeNav, patch: NavPatch): MaybeNav {
  if (patch === null) {
    return NONE;
  }
  if (!defined(patch)) {
    return current;
  }
  const merged: Nav = {
    group: pickNav(current?.group, patch.group),
    icon: pickNav(current?.icon, patch.icon),
    label: pickNav(current?.label, patch.label),
    order: pickNav(current?.order, patch.order),
  };
  if (Object.values(merged).every((value) => !defined(value))) {
    return NONE;
  }
  return merged;
}

/**
 * Patch a vow's nav entry (label · icon · order · group). Omitted keys keep their existing value; a `null`
 * per key unsets that key; a `null` patch clears the whole entry — every field the LLM sets, it can unset.
 */
export function setNav(appDir: string, slug: string, nav: NavPatch): Vow {
  return replace(appDir, slug, (vow) => ({ ...vow, nav: mergeNav(vow.nav, nav) }));
}

/** Delete a vow — remove its `.md` (and any child folder). The tree must stay reference-valid. */
export function removeVow(appDir: string, slug: string): void {
  const tree = loadVows(appDir);
  if (!tree.some((vow: ReadonlyVow) => vow.slug === slug)) {
    throw new Error(`mutate: no vow "${slug}" under ${appDir}`);
  }
  // A removed entity must not be referenced — validate the tree without it first.
  validateReferences(tree.filter((vow: ReadonlyVow) => vow.slug !== slug));
  rmSync(path.join(appDir, slug + SUFFIX), { force: true });
  const childDir = path.join(appDir, slug);
  if (existsSync(childDir)) {
    rmSync(childDir, { force: true, recursive: true });
  }
}
