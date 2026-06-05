import type { Plugin } from "vite-plus";
import { Vow, type Vow as VowNode } from "@vow/core";
import { emitVueSfc } from "@vow/emit-vue";

/**
 * vow as a Vite plugin — the heart of the closed cap.
 *
 * Two virtual modules, both generated in-memory (no file ever touches disk):
 *  - `virtual:vow/tree`             → the whole vow tree as data (observability)
 *  - `virtual:vow/component/<slug>` → a REAL Vue SFC, emitted live from that vow's `emit` fulfilment
 *
 * The app's source IS the vow tree, projected on load. Nothing editable sits between plan and
 * app → nothing can drift.
 */

export const VIRTUAL_TREE = "virtual:vow/tree";
const COMPONENT_PREFIX = "virtual:vow/component/";
/** Vite convention: a resolved virtual id is NUL-prefixed so other plugins leave it alone. */
const NUL = "\0";

export interface VowOptions {
  readonly tree: VowNode;
}

/** The vow tree as a live ES-module source. */
export function vowTreeModule(tree: VowNode): string {
  return `export const tree = ${JSON.stringify(tree)};\nexport default tree;`;
}

/** Depth-first lookup of a vow by its slug. */
export function findVow(vow: VowNode, slug: string): VowNode | undefined {
  if (vow.slug === slug) return vow;
  for (const child of vow.children) {
    const found = findVow(child, slug);
    if (found !== undefined) return found;
  }
  return undefined;
}

/** Resolve a public vow virtual id to its internal NUL-prefixed form; ignore everything else. */
export function resolveVowId(id: string): string | undefined {
  if (id === VIRTUAL_TREE || id.startsWith(COMPONENT_PREFIX)) return NUL + id;
  return undefined;
}

/** Load a vow virtual module: the tree as data, or a vow's `emit` fulfilment as a real Vue SFC. */
export function loadVowModule(id: string, tree: VowNode): string | undefined {
  if (id === NUL + VIRTUAL_TREE) return vowTreeModule(tree);
  if (id.startsWith(NUL + COMPONENT_PREFIX)) {
    const slug = id.slice((NUL + COMPONENT_PREFIX).length);
    const vow = findVow(tree, slug);
    if (vow === undefined) throw new Error(`vow component not found for slug: ${slug}`);
    return emitVueSfc(vow);
  }
  return undefined;
}

/** vow as a Vite plugin: virtual modules project the validated vow tree, live and file-free. */
export function vow(options: VowOptions): Plugin {
  const tree = Vow.parse(options.tree); // fail fast on an invalid tree
  return {
    name: "vow",
    resolveId: (id) => resolveVowId(id),
    load: (id) => loadVowModule(id, tree),
  };
}
