import { NONE, defined } from "./guard.ts";
import { SUFFIX, loadVows, validateReferences } from "./load.ts";
import { existsSync, rmSync } from "node:fs";
import type { ReadonlyVow } from "./readonly.ts";
import { Vow } from "./vow.ts";
import { isEmitEntity } from "./fulfillment.ts";
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
function assertFieldsUnique(slug: string, fields: readonly Field[]): void {
  const seen = new Set<string>();
  for (const field of fields) {
    if (seen.has(field.name)) {
      throw new Error(`add_field: "${slug}" already has a field "${field.name}"`);
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

/** Add a new `emit entity` vow (a data model). */
export function addEntity(
  appDir: string,
  opts: { readonly slug: string; readonly intent: string; readonly fields?: readonly Field[] },
): Vow {
  const fields = opts.fields ?? [];
  assertFieldsUnique(opts.slug, fields);
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
    readonly root?: boolean;
    readonly title?: string;
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
 */
function assertFormTarget(appDir: string, slug: string, of: string): void {
  const entities = loadVows(appDir).filter((vow: ReadonlyVow) => isEmitEntity(vow));
  if (!entities.some((vow: ReadonlyVow) => vow.slug === of)) {
    const known = entities.map((vow: ReadonlyVow) => vow.slug).join(", ");
    throw new Error(`form "${slug}" of: "${of}" is not a known entity — known: ${known}`);
  }
}

/** Add a new `emit form` vow (a bound, validated `## form` over an entity). */
export function addForm(
  appDir: string,
  opts: {
    readonly slug: string;
    readonly intent: string;
    readonly of: string;
    readonly submit: string;
    readonly nav?: ReadonlyVow["nav"];
  },
): Vow {
  assertFormTarget(appDir, opts.slug, opts.of);
  return create(appDir, {
    fields: [],
    form: { of: opts.of, submit: opts.submit },
    fulfills: { as: "form", kind: "emit" },
    intent: opts.intent,
    nav: opts.nav,
    proof: [],
    slug: opts.slug,
  });
}

/** Add a field to an entity — rejects a non-entity target and a duplicate field name. */
export function addField(appDir: string, slug: string, field: Field): Vow {
  return replace(appDir, slug, (vow) => {
    assertEmitEntity("add_field", vow);
    const fields = [...vow.fields, field];
    assertFieldsUnique(slug, fields);
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
