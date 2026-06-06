import { mkdirSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import type { Plugin } from "vite-plus";
import { loadVowForest, type Vow as VowNode } from "@vow/core";
import { emitBindAnchor } from "@vow/emit-bind";
import { emitEntityModule, emitEntityTest } from "@vow/emit-entity";
import { emitCheckboxSfc } from "@vow/emit-primitive";
import { emitViewSfc } from "@vow/emit-view";
import { emitVueSfc } from "@vow/emit-vue";

/**
 * vow as a Vite plugin — the heart of the closed cap.
 *
 * Source of truth = the visible `app/` folder-tree of `vow.md` ("here lives your app, as MDs").
 * The plugin loads it and writes real `.vue` files into the hidden `.generated/` (gitignored,
 * regenerated) — so vue-tsc, Volar and plugin-vue see them (the hard gate + inspectability), but
 * they're never the source and can't drift. Plus `virtual:vow/tree` exposes the forest as data.
 */

export const VIRTUAL_TREE = "virtual:vow/tree";
const NUL = "\0";

export interface VowOptions {
  /** The visible folder-tree of `vow.md` — your app (default: "app"). */
  readonly dir?: string;
  /** The hidden directory for generated `.vue` — machine output (default: ".generated"). */
  readonly outDir?: string;
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

/** Resolve a vow's bind module to a specifier the anchor (sitting in outDir) can import. */
function bindSpecifier(module: string, outDir: string, srcDir: string): string {
  if (!module.startsWith(".") && !module.startsWith("/")) return module; // bare package
  const rel = relative(outDir, resolve(srcDir, module));
  return rel.startsWith(".") ? rel : `./${rel}`;
}

/**
 * Write the real files per fulfilled vow into outDir, by target:
 *   `emit vue`    → `<slug>.vue`
 *   `emit entity` → `<slug>.ts` (interface + factory) + `<slug>.test.ts` (derived proof)
 *   `emit view`   → `<slug>.vue` (typed list over the `of:` entity)
 *   `bind`        → `<slug>.bind.ts` (re-export anchor; tsgo verifies the bound export exists)
 * `srcDir` is where the vows + hand-written bind code live (to resolve relative bind modules).
 * Returns the written paths.
 */
export function generateFiles(vows: readonly VowNode[], outDir: string, srcDir: string): string[] {
  mkdirSync(outDir, { recursive: true });
  const written: string[] = [];
  for (const v of allVows(vows)) {
    const f = v.fulfills;
    if (!f) continue;
    if (f.kind === "emit" && f.as === "vue") {
      const file = join(outDir, `${v.slug}.vue`);
      writeFileSync(file, emitVueSfc(v), "utf8");
      written.push(file);
    } else if (f.kind === "emit" && f.as === "entity") {
      const mod = join(outDir, `${v.slug}.ts`);
      const test = join(outDir, `${v.slug}.test.ts`);
      writeFileSync(mod, emitEntityModule(v), "utf8");
      writeFileSync(test, emitEntityTest(v), "utf8");
      written.push(mod, test);
    } else if (f.kind === "emit" && f.as === "view") {
      const entity = allVows(vows).find(
        (e) => e.slug === v.of && e.fulfills?.kind === "emit" && e.fulfills.as === "entity",
      );
      if (!entity) {
        throw new Error(
          `vow "${v.slug}": emit view references unknown entity (of: ${v.of ?? "—"})`,
        );
      }
      const file = join(outDir, `${v.slug}.vue`);
      writeFileSync(file, emitViewSfc(v, entity), "utf8");
      written.push(file);
      // a boolean field renders as the emitted <Checkbox> → generate the adapter alongside it
      if (entity.fields.some((fld) => fld.type === "boolean")) {
        const cb = join(outDir, "Checkbox.vue");
        writeFileSync(cb, emitCheckboxSfc(), "utf8");
        written.push(cb);
      }
    } else if (f.kind === "bind") {
      const file = join(outDir, `${v.slug}.bind.ts`);
      writeFileSync(file, emitBindAnchor(v, bindSpecifier(f.module, outDir, srcDir)), "utf8");
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

/** vow as a Vite plugin: load `app/`, generate real `.vue` into `.generated/`, expose the tree. */
export function vow(options: VowOptions = {}): Plugin {
  const dirOpt = options.dir ?? "app";
  const outOpt = options.outDir ?? ".generated";
  let vows: readonly VowNode[] = options.vows ?? [];
  let vowDir = dirOpt;
  let genDir = outOpt;

  const regenerate = (): void => {
    vows = options.vows ?? loadVowForest(vowDir);
    generateFiles(vows, genDir, vowDir);
  };

  return {
    name: "vow",
    configResolved(config) {
      vowDir = isAbsolute(dirOpt) ? dirOpt : join(config.root, dirOpt);
      genDir = isAbsolute(outOpt) ? outOpt : join(config.root, outOpt);
      regenerate();
    },
    configureServer(server) {
      // Watch the `app/` source (not in the module graph) → regenerate the `.vue` on change.
      // Rewriting the .vue then triggers plugin-vue's HMR; a full reload covers added/removed vows.
      server.watcher.add(vowDir);
      const onVowChange = (file: string): void => {
        if (file.startsWith(vowDir) && file.endsWith(".md")) {
          regenerate();
          server.ws.send({ type: "full-reload" });
        }
      };
      server.watcher.on("add", onVowChange);
      server.watcher.on("change", onVowChange);
      server.watcher.on("unlink", onVowChange);
    },
    resolveId: (id) => resolveVowId(id),
    load: (id) => loadVowModule(id, vows),
  };
}
