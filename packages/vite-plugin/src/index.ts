import type { Plugin } from "vite-plus";
import { loadVowForest, type Vow as VowNode } from "@vow/core";
import { emitVueModule } from "@vow/emit-vue";

/**
 * vow as a Vite plugin — the heart of the closed cap.
 *
 * Source of truth = the `.vow/` directory (a folder-tree of `vow.md`). The plugin loads it and
 * projects it as virtual modules, generated in-memory (no file on disk):
 *  - `virtual:vow/tree`             → the whole vow forest as data (observability)
 *  - `virtual:vow/component/<slug>` → a runnable Vue component, emitted from that vow's `emit`
 *
 * Nothing editable sits between plan and app → nothing can drift.
 */

export const VIRTUAL_TREE = "virtual:vow/tree";
const COMPONENT_PREFIX = "virtual:vow/component/";
/** Vite convention: a resolved virtual id is NUL-prefixed so other plugins leave it alone. */
const NUL = "\0";

export interface VowOptions {
  /** The `.vow/` directory to load the vow forest from (default: ".vow"). */
  readonly dir?: string;
  /** Inline vows, bypassing `dir` — for tests. */
  readonly vows?: readonly VowNode[];
}

/** The vow forest as a live ES-module source. */
export function vowTreeModule(vows: readonly VowNode[]): string {
  return `export const tree = ${JSON.stringify(vows)};\nexport default tree;`;
}

/** Depth-first lookup of a vow by slug across the forest. */
export function findVow(vows: readonly VowNode[], slug: string): VowNode | undefined {
  for (const vow of vows) {
    if (vow.slug === slug) return vow;
    const found = findVow(vow.children, slug);
    if (found !== undefined) return found;
  }
  return undefined;
}

/** Resolve a public vow virtual id to its internal NUL-prefixed form; ignore everything else. */
export function resolveVowId(id: string): string | undefined {
  if (id === VIRTUAL_TREE || id.startsWith(COMPONENT_PREFIX)) return NUL + id;
  return undefined;
}

/** Load a vow virtual module: the forest as data, or a vow's `emit` fulfilment as a Vue component. */
export function loadVowModule(id: string, vows: readonly VowNode[]): string | undefined {
  if (id === NUL + VIRTUAL_TREE) return vowTreeModule(vows);
  if (id.startsWith(NUL + COMPONENT_PREFIX)) {
    const slug = id.slice((NUL + COMPONENT_PREFIX).length).replace(/\.vue$/, "");
    const vow = findVow(vows, slug);
    if (vow === undefined) throw new Error(`vow component not found for slug: ${slug}`);
    return emitVueModule(vow);
  }
  return undefined;
}

/** vow as a Vite plugin: the `.vow/` forest, projected live and file-free. */
export function vow(options: VowOptions = {}): Plugin {
  const vows = options.vows ?? loadVowForest(options.dir ?? ".vow");
  return {
    name: "vow",
    resolveId: (id) => resolveVowId(id),
    load: (id) => loadVowModule(id, vows),
  };
}
