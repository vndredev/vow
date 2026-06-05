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

const SUFFIX = ".vow.md";

/** Load one vow: its `<slug>.vow.md` in `dir`, plus children from a sibling `<slug>/` folder. */
export function loadVow(dir: string, slug: string): Vow {
  const self = parseVowMd(slug, readFileSync(join(dir, slug + SUFFIX), "utf8"));
  const childDir = join(dir, slug);
  const children = existsSync(childDir) ? loadVowForest(childDir) : [];
  return { ...self, children };
}

/** Load the forest of `<slug>.vow.md` files directly under a directory (sorted, deterministic). */
export function loadVowForest(vowDir: string): Vow[] {
  if (!existsSync(vowDir)) return [];
  return readdirSync(vowDir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(SUFFIX))
    .map((e) => e.name.slice(0, -SUFFIX.length))
    .sort()
    .map((slug) => loadVow(vowDir, slug));
}
