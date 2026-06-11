// oxlint-disable-next-line consistent-type-specifier-style -- one import; separate trips no-duplicate-imports
import { type Artifact, type Contribution, type GroupRef, planVow } from "./plan.ts";
// oxlint-disable-next-line consistent-type-specifier-style -- one import; separate trips no-duplicate-imports
import { type Maybe, type ReadonlyVow, defined, validateReferences } from "@vow/core/node";
// oxlint-disable-next-line consistent-type-specifier-style -- one import; separate trips no-duplicate-imports
import { type Page, allVows, isEntity } from "./vows.ts";
import { VOW_ENV_DTS, emitAppLayout, emitAppRoutes, emitBoot } from "@vow/emit-view";
import {
  composeBoards,
  composeCards,
  composeIssueViews,
  composeLayout,
  composeLists,
  composePrimitives,
  composeStats,
  composeTimeline,
} from "./compose.ts";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { NONE } from "./none.ts";

/**
 * The generator — folds every fulfilled vow into a plan, then writes the real `.vue`/`.ts` files into the
 * hidden `outDir` in one pass.
 *
 * Source of truth = the visible `app/` folder-tree of `vow.md`. The generator writes real files into
 * `.generated/` (gitignored, regenerated) — so vue-tsc, Volar and plugin-vue see them (the hard gate +
 * inspectability), but they're never the source and can't drift. A `## view`'s references pull in
 * compositions on demand plus the primitive adapters those use, so the output stays lean.
 */

/** Where the generator reads from and writes to — the hidden output dir and the visible source dir. */
export interface Dirs {
  /** The hidden directory the `.vue`/`.ts` artifacts are written into. */
  readonly outDir: string;
  /** The source directory the vows + hand-written bind code live in (to resolve relative bind modules). */
  readonly srcDir: string;
}

/** The shell-layout config `emitAppLayout` accepts — the vow's literal unions widened to plain strings. */
interface ShellConfig {
  readonly nav?: string;
  readonly width?: string;
  readonly variant?: string;
}

/** Copy a present string under `key` into `into` — keeps optional keys truly absent (not explicit `undefined`). */
function withShellKey(
  into: ShellConfig,
  key: keyof ShellConfig,
  value: Maybe<string>,
): ShellConfig {
  if (defined(value)) {
    return { ...into, [key]: value };
  }
  return into;
}

/** The folded plan — every contribution merged (collections deduped), ready for compose + write. */
interface Plan {
  readonly files: readonly Artifact[];
  readonly listed: readonly string[];
  readonly stats: readonly GroupRef[];
  readonly cards: readonly string[];
  readonly boards: readonly GroupRef[];
  readonly primitives: readonly string[];
  readonly issueViews: readonly string[];
  readonly pages: readonly Page[];
  readonly needsLayout: boolean;
  readonly needsTimeline: boolean;
}

/** Dedupe group references by `of.by` — the same composition is emitted once however often it is named. */
function dedupeGroups(refs: readonly GroupRef[]): GroupRef[] {
  const byKey = new Map<string, GroupRef>();
  for (const ref of refs) {
    byKey.set(`${ref.of}.${ref.by}`, ref);
  }
  return [...byKey.values()];
}

/** Fold the per-vow contributions into one plan — collecting then deduping each composition kind. */
function foldPlan(contributions: readonly Contribution[]): Plan {
  return {
    boards: dedupeGroups(contributions.flatMap((part) => part.boards)),
    cards: [...new Set(contributions.flatMap((part) => part.cards))],
    files: contributions.flatMap((part) => part.files),
    issueViews: [...new Set(contributions.flatMap((part) => part.issueViews))],
    listed: [...new Set(contributions.flatMap((part) => part.listed))],
    needsLayout: contributions.some((part) => part.needsLayout),
    needsTimeline: contributions.some((part) => part.needsTimeline),
    pages: contributions.flatMap((part) => part.pages),
    primitives: [...new Set(contributions.flatMap((part) => part.primitives))],
    stats: dedupeGroups(contributions.flatMap((part) => part.stats)),
  };
}

/** Widen the root vow's shell config (literal unions) to the plain-string shape `emitAppLayout` accepts. */
function shellConfig(vow: Maybe<ReadonlyVow>): Maybe<ShellConfig> {
  const shell = vow?.shell;
  if (!defined(shell)) {
    return NONE;
  }
  let config: ShellConfig = {};
  config = withShellKey(config, "nav", shell.nav);
  config = withShellKey(config, "width", shell.width);
  config = withShellKey(config, "variant", shell.variant);
  return config;
}

/**
 * Non-root views + forms become routes (`/<slug>`) the boot globs via the `*.routes.ts` convention — so the
 * root page stays `/` and every other page joins it, with no hand-written router. With more than the home
 * page, also emit a shared chrome (`*.layout.vue`). `title:` is the app-shell brand (the plugin fallback).
 */
function composeRoutes(
  pages: readonly Page[],
  rootVow: Maybe<ReadonlyVow>,
  shell: { readonly outDir: string; readonly title: Maybe<string> },
): readonly Artifact[] {
  if (pages.length === 0) {
    return [];
  }
  const appTitle = rootVow?.title ?? shell.title;
  return [
    { path: `${shell.outDir}/vow-pages.routes.ts`, source: emitAppRoutes(pages) },
    {
      path: `${shell.outDir}/vow-app.layout.vue`,
      source: emitAppLayout(pages, appTitle, shellConfig(rootVow)),
    },
  ];
}

/** The generated boot (main.ts) + the env shims for the root vow — the app needs no hand-written `src/`. */
function composeBootFiles(rootVow: Maybe<ReadonlyVow>, outDir: string): readonly Artifact[] {
  if (!defined(rootVow)) {
    return [];
  }
  return [
    { path: `${outDir}/main.ts`, source: emitBoot(rootVow.slug) },
    { path: `${outDir}/vow-env.d.ts`, source: VOW_ENV_DTS },
  ];
}

/** The app chrome (routes + layout) plus the boot — everything the entry `root: true` page needs. */
function composeAppShell(
  vows: readonly ReadonlyVow[],
  pages: readonly Page[],
  shell: { readonly outDir: string; readonly title: Maybe<string> },
): readonly Artifact[] {
  const rootVow = vows.find((vow) => vow.root === true && defined(vow.view));
  return [...composeRoutes(pages, rootVow, shell), ...composeBootFiles(rootVow, shell.outDir)];
}

/** Run the composition phase — the on-demand compositions plus every primitive + layout adapter. */
function composeAll(plan: Plan, entities: readonly ReadonlyVow[], dirs: Dirs): readonly Artifact[] {
  const { outDir, srcDir } = dirs;
  const composed = [
    composeLists(plan.listed, entities, outDir),
    composeStats(plan.stats, entities, outDir),
    composeCards(plan.cards, entities, outDir),
    composeBoards(plan.boards, entities, outDir),
    composeTimeline(plan.needsTimeline, srcDir, outDir),
    composeIssueViews(plan.issueViews, outDir),
  ];
  const primitives = [...plan.primitives, ...composed.flatMap((piece) => piece.primitives)];
  return [
    ...composed.flatMap((piece) => piece.files),
    ...composePrimitives(primitives, outDir),
    ...composeLayout(plan.needsLayout, outDir),
  ];
}

/** The basename of a path — the segment after the last separator. */
function basename(filePath: string): string {
  return filePath.slice(filePath.lastIndexOf("/") + 1);
}

/**
 * A case-insensitive output-name collision (macOS/Windows): two basenames equal but for case — a view
 * slug `table` vs the `Table` primitive — would clobber each other. Returns the clashing pair, or none.
 */
export function caseCollision(paths: readonly string[]): Maybe<readonly [string, string]> {
  const seen = new Map<string, string>();
  for (const filePath of paths) {
    const base = basename(filePath);
    const prior = seen.get(base.toLowerCase());
    if (defined(prior) && prior !== base) {
      return [prior, base];
    }
    seen.set(base.toLowerCase(), base);
  }
  return NONE;
}

/** Throw a clear error if any two written paths differ only in case (would clobber each other). */
function assertNoCollision(paths: readonly string[]): void {
  const clash = caseCollision(paths);
  if (!defined(clash)) {
    return;
  }
  throw new Error(
    `vow: output collision — "${clash[0]}" and "${clash[1]}" differ only in case and would ` +
      `overwrite each other on a case-insensitive filesystem. Rename the view slug so it doesn't match a component.`,
  );
}

/** Project every vow into the folded plan — the scan phase, isolated so the entry stays small. */
function planAll(all: readonly ReadonlyVow[], entities: readonly ReadonlyVow[], dirs: Dirs): Plan {
  const ctx = {
    entities,
    entitySlugs: entities.map((entity) => entity.slug),
    outDir: dirs.outDir,
    srcDir: dirs.srcDir,
  };
  return foldPlan(all.map((vow) => planVow(vow, ctx)));
}

/** Gather every artifact: the per-vow files, the on-demand compositions, and the app shell + boot. */
function collectArtifacts(
  all: readonly ReadonlyVow[],
  entities: readonly ReadonlyVow[],
  opts: { readonly dirs: Dirs; readonly title: Maybe<string> },
): readonly Artifact[] {
  const { dirs, title } = opts;
  const plan = planAll(all, entities, dirs);
  return [
    ...plan.files,
    ...composeAll(plan, entities, dirs),
    ...composeAppShell(all, plan.pages, { outDir: dirs.outDir, title }),
  ];
}

/** The content last written to each path — so an unchanged artifact skips its `writeFileSync`. */
const lastWritten = new Map<string, string>();

/** The path's current content (cached last-write, else on-disk), or none when it has never been written. */
function currentContent(path: string): Maybe<string> {
  const cached = lastWritten.get(path);
  if (defined(cached)) {
    return cached;
  }
  try {
    return readFileSync(path, "utf8");
  } catch {
    // The file does not exist yet — there is nothing to compare against, so the artifact must be written.
    return NONE;
  }
}

/**
 * Write an artifact only when its content changed — an identical source is a no-op (no `writeFileSync`).
 * This keeps a single edit from rewriting the whole `.generated/` tree byte-for-byte on every save.
 */
function writeArtifact(artifact: Artifact): void {
  if (currentContent(artifact.path) === artifact.source) {
    return;
  }
  writeFileSync(artifact.path, artifact.source, "utf8");
  lastWritten.set(artifact.path, artifact.source);
}

/**
 * Write the real files per fulfilled vow into `dirs.outDir`. `title` is the app-shell brand fallback.
 * Returns the written paths.
 */
export function generateFiles(vows: readonly ReadonlyVow[], dirs: Dirs, title?: string): string[] {
  // Fail loud on a dangling `reference(<entity>)` before generating anything.
  validateReferences(vows);
  mkdirSync(dirs.outDir, { recursive: true });
  const all = allVows(vows);
  // Filter `all` directly — `entityVows(all)` re-flattens it + duplicates nested entities.
  const artifacts = collectArtifacts(
    all,
    all.filter((vow) => isEntity(vow)),
    { dirs, title },
  );
  const paths = artifacts.map((artifact) => artifact.path);
  assertNoCollision(paths);
  for (const artifact of artifacts) {
    writeArtifact(artifact);
  }
  return paths;
}
