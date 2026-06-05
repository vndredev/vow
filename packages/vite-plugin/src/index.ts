import { mkdirSync, writeFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import type { Plugin } from "vite-plus";
import { loadVowForest, type Vow as VowNode } from "@vow/core";
import { emitVueSfc } from "@vow/emit-vue";

/**
 * vow as a Vite plugin — the heart of the closed cap.
 *
 * Source of truth = the `.vow/` folder-tree of `vow.md`. The plugin loads it and writes real
 * `.vue` files into `.vow/generated/` (gitignored, regenerated) — so vue-tsc, Volar and plugin-vue
 * see them (the hard gate + inspectability), but they're never the source and can't drift.
 * Plus `virtual:vow/tree` exposes the forest as data for observability.
 */

export const VIRTUAL_TREE = "virtual:vow/tree";
const NUL = "\0";

export interface VowOptions {
  /** The `.vow/` directory (default: ".vow"). */
  readonly dir?: string;
  /** Inline vows, bypassing `dir` — for tests. */
  readonly vows?: readonly VowNode[];
}

/** Flatten the forest into every vow, depth-first. */
export function allVows(vows: readonly VowNode[]): VowNode[] {
  return vows.flatMap((v) => [v, ...allVows(v.children)]);
}

/** The vow forest as a live ES-module source (observability). */
export function vowTreeModule(vows: readonly VowNode[]): string {
  return `export const tree = ${JSON.stringify(vows)};\nexport default tree;`;
}

/** Write a real `.vue` per `emit` vow into outDir. Returns the written paths. */
export function generateVueFiles(vows: readonly VowNode[], outDir: string): string[] {
  mkdirSync(outDir, { recursive: true });
  const written: string[] = [];
  for (const v of allVows(vows)) {
    if (v.fulfills?.kind === "emit") {
      const file = join(outDir, `${v.slug}.vue`);
      writeFileSync(file, emitVueSfc(v), "utf8");
      written.push(file);
    }
  }
  return written;
}

/** Resolve the tree virtual id to its NUL-prefixed form; ignore everything else. */
export function resolveVowId(id: string): string | undefined {
  return id === VIRTUAL_TREE ? NUL + id : undefined;
}

/** Load the tree virtual module (the forest as data); ignore everything else. */
export function loadVowModule(id: string, vows: readonly VowNode[]): string | undefined {
  return id === NUL + VIRTUAL_TREE ? vowTreeModule(vows) : undefined;
}

/** vow as a Vite plugin: load `.vow/`, generate real `.vue` into `.vow/generated/`, expose the tree. */
export function vow(options: VowOptions = {}): Plugin {
  const dirOpt = options.dir ?? ".vow";
  let vows: readonly VowNode[] = options.vows ?? [];
  let vowDir = dirOpt;

  const regenerate = (): void => {
    vows = options.vows ?? loadVowForest(vowDir);
    generateVueFiles(vows, join(vowDir, "generated"));
  };

  return {
    name: "vow",
    configResolved(config) {
      vowDir = isAbsolute(dirOpt) ? dirOpt : join(config.root, dirOpt);
      regenerate();
    },
    resolveId: (id) => resolveVowId(id),
    load: (id) => loadVowModule(id, vows),
  };
}
