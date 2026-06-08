import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { loadVows, SUFFIX, validateReferences } from "./load.ts";
import { writeVow } from "./serialize.ts";
import { type Field, Vow, type ViewNode } from "./vow.ts";

/**
 * The structure mutations — the typed authoring API over the vow tree (`@vow/core`'s write side, built on
 * `loadVows` + `serialize`/`writeVow`). Each loads the tree, mutates one vow in memory, **validates the
 * whole tree** (`Vow.parse` + `validateReferences`) before writing, then writes just that vow's `.md` — so
 * a running `vp dev` regenerates. Data (records) is NOT here — that's `@vow/db`'s CRUD; `@vow/mcp` composes
 * the two. No separate `@vow/author` package: authoring the tree is the same concern as parsing it.
 */

/** A stable id from a slug — `vow_<slug without hyphens>` (the `^[a-z]+_[a-z0-9]+$` shape). */
function idFor(slug: string): string {
  return `vow_${slug.replace(/-/g, "")}`;
}

/** Replace the vow with `slug` in the tree, validate the whole tree, then write just that vow's file. */
function replace(appDir: string, slug: string, mutate: (vow: Vow) => Vow): Vow {
  const tree = loadVows(appDir);
  const target = tree.find((v) => v.slug === slug);
  if (!target) throw new Error(`mutate: no vow "${slug}" under ${appDir}`);
  const updated = Vow.parse(mutate(target));
  validateReferences(tree.map((v) => (v.slug === slug ? updated : v)));
  writeVow(appDir, updated);
  return updated;
}

/** Create a vow with `slug` (must not exist), validate, write it. */
function create(appDir: string, draft: Record<string, unknown>): Vow {
  const tree = loadVows(appDir);
  const slug = String(draft["slug"]);
  if (tree.some((v) => v.slug === slug)) throw new Error(`mutate: vow "${slug}" already exists`);
  const vow = Vow.parse({ id: idFor(slug), ...draft });
  validateReferences([...tree, vow]);
  writeVow(appDir, vow);
  return vow;
}

/** Add a new `emit entity` vow (a data model). */
export function addEntity(
  appDir: string,
  opts: { slug: string; intent: string; fields?: readonly Field[] },
): Vow {
  return create(appDir, {
    slug: opts.slug,
    intent: opts.intent,
    fulfills: { kind: "emit", as: "entity" },
    fields: opts.fields ?? [],
  });
}

/** Add a new `emit view` vow (a page built from a `## view`). */
export function addView(
  appDir: string,
  opts: {
    slug: string;
    intent: string;
    view: readonly ViewNode[];
    nav?: Vow["nav"];
    root?: boolean;
    title?: string;
    shell?: Vow["shell"];
  },
): Vow {
  return create(appDir, {
    slug: opts.slug,
    intent: opts.intent,
    fulfills: { kind: "emit", as: "view" },
    view: opts.view,
    nav: opts.nav,
    root: opts.root,
    title: opts.title,
    shell: opts.shell,
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
    fields: vow.fields.filter((f) => f.name !== fieldName),
  }));
}

/** Set a vow's intent (the `# …` promise). */
export function setIntent(appDir: string, slug: string, intent: string): Vow {
  return replace(appDir, slug, (vow) => ({ ...vow, intent }));
}

/** Set a vow's nav entry (label · icon · order · group). */
export function setNav(appDir: string, slug: string, nav: Vow["nav"]): Vow {
  return replace(appDir, slug, (vow) => ({ ...vow, nav }));
}

/** Delete a vow — remove its `.md` (and any child folder). The tree must stay reference-valid. */
export function removeVow(appDir: string, slug: string): void {
  const tree = loadVows(appDir);
  if (!tree.some((v) => v.slug === slug))
    throw new Error(`mutate: no vow "${slug}" under ${appDir}`);
  validateReferences(tree.filter((v) => v.slug !== slug)); // a removed entity must not be referenced
  rmSync(join(appDir, slug + SUFFIX), { force: true });
  const childDir = join(appDir, slug);
  if (existsSync(childDir)) rmSync(childDir, { recursive: true, force: true });
}
