import { SUFFIX, loadVows, validateReferences } from "./load.ts";
import { existsSync, rmSync } from "node:fs";
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
/** A draft vow — a readonly structure passed to `Vow.parse` (which validates and freezes the shape). */
type Draft = Omit<ReadonlyVow, "children" | "id">;

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

/** Add a new `emit entity` vow (a data model). */
export function addEntity(
  appDir: string,
  opts: { readonly slug: string; readonly intent: string; readonly fields?: readonly Field[] },
): Vow {
  return create(appDir, {
    fields: opts.fields ?? [],
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

/** Add a field to an entity. */
export function addField(appDir: string, slug: string, field: Field): Vow {
  return replace(appDir, slug, (vow) => ({ ...vow, fields: [...vow.fields, field] }));
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

/** Set a vow's nav entry (label · icon · order · group). */
export function setNav(appDir: string, slug: string, nav: ReadonlyVow["nav"]): Vow {
  return replace(appDir, slug, (vow) => ({ ...vow, nav }));
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
