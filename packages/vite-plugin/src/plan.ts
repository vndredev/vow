// oxlint-disable-next-line consistent-type-specifier-style -- one import; separate trips no-duplicate-imports
import { type Page, navPage } from "./vows.ts";
// oxlint-disable-next-line consistent-type-specifier-style -- one import; separate trips no-duplicate-imports
import { type ReadonlyVow, defined, isEmit } from "@vow/core";
import {
  boardRefs,
  buildView,
  cardsRefs,
  emitForm,
  emitFormTest,
  emitViewTest,
  feedLayouts,
  issueLayouts,
  listedEntities,
  statsRefs,
  usesTimeline,
} from "@vow/emit-view";
import { emitEntityModule, emitEntityTest } from "@vow/emit-entity";
import { mutable, mutableIndex } from "./mutable.ts";
import { emitBindAnchor } from "@vow/emit-bind";
import path from "node:path";

/**
 * The scan phase — a pure projection of each fulfilled vow into the files + compositions it contributes.
 *
 * Nothing is written here: each writer returns a `Contribution` (the direct files plus the deferred
 * composition references + primitives), and `generate.ts` folds them and emits. Keeping the scan pure (no
 * shared mutable accumulator) is what lets every parameter stay readonly — the strict-wall requirement.
 */

/** A file to write — its absolute path and its full source. */
export interface Artifact {
  readonly path: string;
  readonly source: string;
}

/** A reference to a counts/kanban composition: the entity slug and the field it groups by. */
export interface GroupRef {
  readonly of: string;
  readonly by: string;
}

/** A reference to an entity's list composition: the entity slug and whether the opt-in per-row delete is on.
 *  Mirrors `@vow/emit-view`'s `ListRef` structurally (the `listedEntities` return), kept local so the cross-
 *  package type stays out of the import sort — exactly how `GroupRef` mirrors that package's `FieldRef`. */
export interface ListRef {
  readonly of: string;
  readonly delete: boolean;
}

/** What one vow contributes: its direct files, the compositions it references, and the page it adds. */
export interface Contribution {
  readonly files: readonly Artifact[];
  readonly listed: readonly ListRef[];
  readonly stats: readonly GroupRef[];
  readonly cards: readonly string[];
  readonly boards: readonly GroupRef[];
  readonly primitives: readonly string[];
  readonly issueViews: readonly string[];
  readonly feedViews: readonly string[];
  readonly pages: readonly Page[];
  readonly needsLayout: boolean;
  readonly needsTimeline: boolean;
}

/** The empty contribution — the base every writer extends through `contribution(...)`. */
const NOTHING: Contribution = {
  boards: [],
  cards: [],
  feedViews: [],
  files: [],
  issueViews: [],
  listed: [],
  needsLayout: false,
  needsTimeline: false,
  pages: [],
  primitives: [],
  stats: [],
};

/** Build a contribution from partial fields, defaulting the rest to the empty contribution. */
function contribution(parts: Partial<Contribution>): Contribution {
  return { ...NOTHING, ...parts };
}

/** Resolve a vow's bind module to a specifier the anchor (sitting in outDir) can import. */
function bindSpecifier(module: string, outDir: string, srcDir: string): string {
  if (!module.startsWith(".") && !module.startsWith("/")) {
    // A bare package specifier is imported as-is.
    return module;
  }
  const rel = path.relative(outDir, path.resolve(srcDir, module));
  if (rel.startsWith(".")) {
    return rel;
  }
  return `./${rel}`;
}

/** `emit entity` → `<slug>.ts` (type + factory) + `<slug>.test.ts` (a pure model, derived proof). */
function planEntity(vow: ReadonlyVow, outDir: string): Contribution {
  return contribution({
    files: [
      { path: path.join(outDir, `${vow.slug}.ts`), source: emitEntityModule(mutable(vow)) },
      { path: path.join(outDir, `${vow.slug}.test.ts`), source: emitEntityTest(mutable(vow)) },
    ],
  });
}

/** A non-root view becomes a routed page; the root view is the entry `/`, not a sidebar entry. */
function viewPages(vow: ReadonlyVow): Page[] {
  if (vow.root === true) {
    return [];
  }
  return [navPage(vow)];
}

/** `emit view` → `<slug>.vue` from its `## view`, plus every composition + primitive it references. */
function planView(vow: ReadonlyVow, outDir: string, entitySlugs: readonly string[]): Contribution {
  if (!defined(vow.view)) {
    throw new Error(`vow "${vow.slug}": an \`emit view\` needs a \`## view\` block`);
  }
  const pages = viewPages(vow);
  const built = buildView(mutable(vow), entitySlugs);
  return contribution({
    boards: boardRefs(mutable(vow)),
    cards: cardsRefs(mutable(vow)),
    feedViews: [...feedLayouts(mutable(vow))],
    files: [
      { path: path.join(outDir, `${vow.slug}.vue`), source: built.sfc },
      { path: path.join(outDir, `${vow.slug}.render.test.ts`), source: emitViewTest(mutable(vow)) },
    ],
    issueViews: [...issueLayouts(mutable(vow))],
    listed: listedEntities(mutable(vow)),
    needsLayout: true,
    needsTimeline: usesTimeline(mutable(vow)),
    pages,
    primitives: built.primitives,
    stats: statsRefs(mutable(vow)),
  });
}

/** The extra primitive adapters a form pulls in for its entity's field types (checkbox / select). */
function formFieldPrimitives(entity: ReadonlyVow | undefined): readonly string[] {
  if (!defined(entity)) {
    return [];
  }
  const extra: string[] = [];
  if (entity.fields.some((field) => field.type === "boolean")) {
    extra.push("Checkbox");
  }
  if (entity.fields.some((field) => field.type === "select" || field.type === "reference")) {
    extra.push("Select");
  }
  return extra;
}

/** `emit form` → `<slug>.vue`: a bound, validated form of fields + a submit button (its own page). */
function planForm(
  vow: ReadonlyVow,
  outDir: string,
  entities: readonly ReadonlyVow[],
): Contribution {
  const ofSlug = vow.form?.of ?? "";
  const entity = entities.find((candidate) => candidate.slug === ofSlug);
  // Prove "rejects an incomplete submit" only for a create form (a required field, else no error).
  // An edit/singleton form guards on a loaded row, so an empty submit no-ops rather than validating.
  const provesSubmit =
    (entity?.fields.some((field) => field.required) ?? false) && vow.form?.edit !== true;
  const files = [
    {
      path: path.join(outDir, `${vow.slug}.vue`),
      source: emitForm(mutable(vow), mutableIndex(entities)),
    },
    { path: path.join(outDir, `${vow.slug}.render.test.ts`), source: emitViewTest(mutable(vow)) },
  ];
  if (provesSubmit) {
    files.push({
      path: path.join(outDir, `${vow.slug}.form.test.ts`),
      source: emitFormTest(mutable(vow), provesSubmit),
    });
  }
  return contribution({
    files,
    pages: [navPage(vow)],
    primitives: ["Field", "Button", ...formFieldPrimitives(entity)],
  });
}

/** `bind` → `<slug>.bind.ts`: a re-export anchor tsgo verifies (the bound export must exist). */
function planBind(vow: ReadonlyVow, outDir: string, srcDir: string): Contribution {
  const { fulfills } = vow;
  if (fulfills?.kind !== "bind") {
    return NOTHING;
  }
  const specifier = bindSpecifier(fulfills.module, outDir, srcDir);
  return contribution({
    files: [
      {
        path: path.join(outDir, `${vow.slug}.bind.ts`),
        source: emitBindAnchor(mutable(vow), specifier),
      },
    ],
  });
}

/** The shared context every per-vow projection reads — the output dirs and the entity index. */
export interface PlanContext {
  readonly outDir: string;
  readonly srcDir: string;
  readonly entities: readonly ReadonlyVow[];
  readonly entitySlugs: readonly string[];
}

/** Project one vow to its contribution; pure-composition vows (no `fulfills`) contribute nothing. */
export function planVow(vow: ReadonlyVow, ctx: PlanContext): Contribution {
  const { fulfills } = vow;
  if (!defined(fulfills)) {
    return NOTHING;
  }
  if (isEmit(vow, "entity")) {
    return planEntity(vow, ctx.outDir);
  }
  if (isEmit(vow, "view")) {
    return planView(vow, ctx.outDir, ctx.entitySlugs);
  }
  if (isEmit(vow, "form")) {
    return planForm(vow, ctx.outDir, ctx.entities);
  }
  return planBind(vow, ctx.outDir, ctx.srcDir);
}
