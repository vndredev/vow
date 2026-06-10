import type { Maybe, ReadonlyVow } from "@vow/core";
import { NONE } from "./none.ts";

/**
 * The `virtual:vow/tree` module — the vows exposed as a live ES module (observability).
 *
 * Vite resolves a virtual id to its NUL-prefixed internal form, then loads that form's source. The plugin
 * delegates both hooks here so the resolve/load seam stays one small, testable concern.
 */

/** The public id consumers import — `import { tree } from "virtual:vow/tree"`. */
export const VIRTUAL_TREE = "virtual:vow/tree";

/** Vite's convention: a resolved virtual id is prefixed with NUL so no other plugin claims it. */
const NUL = "\0";

/** The vows as a self-contained ES-module source. */
export function vowTreeModule(vows: readonly ReadonlyVow[]): string {
  return `export const tree = ${JSON.stringify(vows)};\nexport default tree;`;
}

/** Resolve the tree virtual id to its NUL-prefixed form; ignore everything else. */
export function resolveVowId(id: string): Maybe<string> {
  if (id === VIRTUAL_TREE) {
    return NUL + VIRTUAL_TREE;
  }
  return NONE;
}

/** Load the tree virtual module (the vows as data); ignore everything else. */
export function loadVowModule(id: string, vows: readonly ReadonlyVow[]): Maybe<string> {
  if (id === NUL + VIRTUAL_TREE) {
    return vowTreeModule(vows);
  }
  return NONE;
}
