import { existsSync, readFileSync, readdirSync } from "node:fs";
import type { ReadonlyVow } from "./readonly.ts";
import type { Vow } from "./vow.ts";
import { isEmitEntity } from "./fulfillment.ts";
import { parseVowMd } from "./parse.ts";
import path from "node:path";

/**
 * Load the vow tree from a directory of `<slug>.vow.md` files. The filename IS the slug — visible,
 * tab-distinct, greppable (no "index.js" trap, where every tab reads `vow.md`). Nesting is optional:
 * a `<slug>/` folder beside a `<slug>.vow.md` holds its children. The tree is the source of truth —
 * versioned, git-diffable, human- and LLM-readable. (Node-side only; runs in vite.config / vp.)
 */

export const SUFFIX = ".vow.md";

/** The slugs of `<slug>.vow.md` files directly under a directory, sorted (deterministic). */
function childSlugs(dir: string): string[] {
  if (!existsSync(dir)) {
    return [];
  }
  return readdirSync(dir)
    .filter((name) => name.endsWith(SUFFIX))
    .map((name) => name.slice(0, -SUFFIX.length))
    .toSorted();
}

/** Load one vow: its `<slug>.vow.md` in `dir`, plus children from a sibling `<slug>/` folder. */
export function loadVow(dir: string, slug: string): Vow {
  const self = parseVowMd(slug, readFileSync(path.join(dir, slug + SUFFIX), "utf8"));
  const childDir = path.join(dir, slug);
  const children = childSlugs(childDir).map((childSlug) => loadVow(childDir, childSlug));
  return { ...self, children };
}

/** Load the vows from `<slug>.vow.md` files directly under a directory (sorted, deterministic). */
export function loadVows(vowDir: string): Vow[] {
  return childSlugs(vowDir).map((slug) => loadVow(vowDir, slug));
}

/** Every vow, depth-first (the recursive node flattened). */
function everyVow(vows: readonly ReadonlyVow[]): ReadonlyVow[] {
  return vows.flatMap((vow) => [vow, ...everyVow(vow.children)]);
}

/**
 * Cross-vow integrity: every `reference(<entity>)` field must point at a real `emit entity`. A dangling
 * reference is a structural error — fail loud, before anything is generated. Run on the whole vow tree
 * (never a sub-tree), so a reference can target an entity anywhere.
 */
export function validateReferences(vows: readonly ReadonlyVow[]): void {
  const all = everyVow(vows);
  const entities = new Set(all.filter((vow) => isEmitEntity(vow)).map((vow) => vow.slug));
  for (const vow of all) {
    for (const field of vow.fields) {
      if (field.type === "reference" && !entities.has(field.ref ?? "")) {
        throw new Error(
          `vow: "${vow.slug}.${field.name}" references "${field.ref ?? ""}", which is not a known entity`,
        );
      }
    }
  }
}
