import { mkdirSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import type { Plugin } from "vite-plus";
import { loadVowForest, type Vow as VowNode } from "@vow/core";
import { emitBindAnchor } from "@vow/emit-bind";
import { emitEntityModule, emitEntityTest } from "@vow/emit-entity";
import { emitCheckboxSfc } from "@vow/emit-primitive";
import {
  emitBoot,
  emitEntityList,
  emitView,
  listedEntities,
  VOW_ENV_DTS,
  viewComponentName,
} from "@vow/emit-view";
import { layoutSfcs } from "@vow/layout";

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
 *   `emit entity` → `<slug>.ts` + `<slug>.test.ts` (a pure model: type + factory + derived proof)
 *   `emit view`   → `<slug>.vue` from its `## view`; its `list:` references pull in entity lists
 *   `bind`        → `<slug>.bind.ts` (re-export anchor; tsgo verifies the bound export exists)
 * An entity's list view (`<Name>.vue`) is emitted only when a `## view` references it via `list:` —
 * the entity is never auto-rendered. `srcDir` is where the vows + hand-written bind code live (to
 * resolve relative bind modules). Returns the written paths.
 */
export function generateFiles(vows: readonly VowNode[], outDir: string, srcDir: string): string[] {
  mkdirSync(outDir, { recursive: true });
  const written: string[] = [];
  const all = allVows(vows);
  const entityBySlug = new Map(
    all
      .filter((e) => e.fulfills?.kind === "emit" && e.fulfills.as === "entity")
      .map((e) => [e.slug, e] as const),
  );
  const entities = [...entityBySlug.keys()]; // slugs a `## view`'s `list:` may reference
  const listed = new Set<string>(); // entity slugs a `## view` actually renders via `list:`
  let needsLayout = false; // any `emit view` pulls in the layout primitives

  for (const v of all) {
    const f = v.fulfills;
    if (!f) continue;
    if (f.kind === "emit" && f.as === "entity") {
      const mod = join(outDir, `${v.slug}.ts`);
      const test = join(outDir, `${v.slug}.test.ts`);
      writeFileSync(mod, emitEntityModule(v), "utf8");
      writeFileSync(test, emitEntityTest(v), "utf8");
      written.push(mod, test);
    } else if (f.kind === "emit" && f.as === "view") {
      if (!v.view) {
        throw new Error(`vow "${v.slug}": an \`emit view\` needs a \`## view\` block`);
      }
      const file = join(outDir, `${v.slug}.vue`);
      writeFileSync(file, emitView(v, entities), "utf8");
      written.push(file);
      for (const slug of listedEntities(v)) listed.add(slug);
      needsLayout = true;
    } else if (f.kind === "bind") {
      const file = join(outDir, `${v.slug}.bind.ts`);
      writeFileSync(file, emitBindAnchor(v, bindSpecifier(f.module, outDir, srcDir)), "utf8");
      written.push(file);
    }
  }

  // A view's `list: <entity>` instantiates that entity's CRUD list — emitted here, on demand. A
  // boolean field in any listed entity renders as <Checkbox>, so emit the adapter once if needed.
  let needsCheckbox = false;
  for (const slug of listed) {
    const entity = entityBySlug.get(slug);
    if (!entity) continue; // emitView already validated the reference; defensive
    const file = join(outDir, `${viewComponentName(entity)}.vue`);
    writeFileSync(file, emitEntityList(entity), "utf8");
    written.push(file);
    if (entity.fields.some((fld) => fld.type === "boolean")) needsCheckbox = true;
  }
  if (needsCheckbox) {
    const cb = join(outDir, "Checkbox.vue");
    writeFileSync(cb, emitCheckboxSfc(), "utf8");
    written.push(cb);
  }
  // A `## view` imports `./<Primitive>.vue`; emit the layout primitives so those resolve (and are
  // themselves type-checked by `vp check`). Written wholesale — the unused ones are harmless.
  if (needsLayout) {
    for (const { name, sfc } of layoutSfcs()) {
      const file = join(outDir, `${name}.vue`);
      writeFileSync(file, sfc, "utf8");
      written.push(file);
    }
  }
  // The app's entry: a `root: true` page. Generate the boot (main.ts) + the *.vue/*.css shims, so the
  // app needs no hand-written `src/` shell — index.html loads `.generated/main.ts`.
  const rootVow = all.find((v) => v.root === true && v.view);
  if (rootVow) {
    const boot = join(outDir, "main.ts");
    const env = join(outDir, "vow-env.d.ts");
    writeFileSync(boot, emitBoot(rootVow.slug), "utf8");
    writeFileSync(env, VOW_ENV_DTS, "utf8");
    written.push(boot, env);
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
