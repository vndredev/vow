import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseVowMd } from "./parse.ts";
import type { Vow } from "./vow.ts";

/**
 * Load the vow tree from a directory of `<slug>.vow.md` files. The filename IS the slug — visible,
 * tab-distinct, greppable (no "index.js" trap, where every tab reads `vow.md`). Nesting is optional:
 * a `<slug>/` folder beside a `<slug>.vow.md` holds its children. The tree is the source of truth —
 * versioned, git-diffable, human- and LLM-readable. (Node-side only; runs in vite.config / vp.)
 */

export const SUFFIX = ".vow.md";

/** Load one vow: its `<slug>.vow.md` in `dir`, plus children from a sibling `<slug>/` folder. */
export function loadVow(dir: string, slug: string): Vow {
  const self = parseVowMd(slug, readFileSync(join(dir, slug + SUFFIX), "utf8"));
  const childDir = join(dir, slug);
  const children = existsSync(childDir) ? loadVows(childDir) : [];
  return { ...self, children };
}

/** Load the vows from `<slug>.vow.md` files directly under a directory (sorted, deterministic). */
export function loadVows(vowDir: string): Vow[] {
  if (!existsSync(vowDir)) return [];
  return readdirSync(vowDir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(SUFFIX))
    .map((e) => e.name.slice(0, -SUFFIX.length))
    .sort()
    .map((slug) => loadVow(vowDir, slug));
}

/** Every vow, depth-first (the recursive node flattened). */
function everyVow(vows: readonly Vow[]): Vow[] {
  return vows.flatMap((v) => [v, ...everyVow(v.children)]);
}

/**
 * Cross-vow integrity: every `reference(<entity>)` field must point at a real `emit entity`. A dangling
 * reference is a structural error — fail loud, before anything is generated. Run on the whole vow tree
 * (never a sub-tree), so a reference can target an entity anywhere.
 */
export function validateReferences(vows: readonly Vow[]): void {
  const all = everyVow(vows);
  const entities = new Set(
    all.filter((v) => v.fulfills?.kind === "emit" && v.fulfills.as === "entity").map((v) => v.slug),
  );
  for (const v of all) {
    for (const f of v.fields) {
      if (f.type === "reference" && !entities.has(f.ref ?? "")) {
        throw new Error(
          `vow: "${v.slug}.${f.name}" references "${f.ref ?? ""}", which is not a known entity`,
        );
      }
    }
  }
}
