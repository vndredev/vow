import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseVowMd } from "./parse.ts";
import type { Vow } from "./vow.ts";

/**
 * Load the vow tree from a `.vow/` directory. The folder structure IS the tree:
 * each folder with a `vow.md` is one vow, its subfolders are its children (depth-first).
 * The slug comes from the folder name. The whole thing is the source of truth — versioned,
 * git-diffable, human- and LLM-readable. (Node-side only; runs in vite.config / vp, never the browser.)
 */

/** Load one vow from its folder: `vow.md` + children from subfolders. */
export function loadVow(dir: string, slug: string): Vow {
  const self = parseVowMd(slug, readFileSync(join(dir, "vow.md"), "utf8"));
  const children = childFolders(dir).map((name) => loadVow(join(dir, name), name));
  return { ...self, children };
}

/** Load the forest of top-level vows under a `.vow/` directory. */
export function loadVowForest(vowDir: string): Vow[] {
  if (!existsSync(vowDir)) return [];
  return childFolders(vowDir).map((name) => loadVow(join(vowDir, name), name));
}

/** Subfolders that contain a `vow.md`, sorted for deterministic order. */
function childFolders(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(dir, e.name, "vow.md")))
    .map((e) => e.name)
    .sort();
}
