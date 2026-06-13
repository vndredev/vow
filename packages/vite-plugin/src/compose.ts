import type { Artifact, GroupRef, ListRef } from "./plan.ts";
// oxlint-disable-next-line consistent-type-specifier-style -- one import; separate trips no-duplicate-imports
import { type Maybe, type ReadonlyVow, defined } from "@vow/core";
import {
  boardComponentName,
  cardsComponentName,
  emitEntityBoard,
  emitEntityCards,
  emitEntityList,
  emitEntityStats,
  emitEventTraceSfc,
  emitIssueBoardSfc,
  emitIssueRoadmapSfc,
  emitIssueTableSfc,
  emitTimelineSfc,
  statsComponentName,
  viewComponentName,
} from "@vow/emit-view";
import { gitRemoteUrl, gitTimeline, headCommit } from "@vow/observability";
import { mutable, mutableIndex } from "./mutable.ts";
import { NONE } from "./none.ts";
import { PRIMITIVE_ADAPTERS } from "@vow/emit-primitive";
import { layoutSfcs } from "@vow/layout";
import path from "node:path";

/**
 * The composition phase — the on-demand compositions a `## view` references (a list, stats, cards, a
 * kanban, the git timeline, the live issue views) plus the primitive adapters they and the views need.
 *
 * Each producer is pure: it returns the artifacts to write and the extra primitives those artifacts use,
 * so `generate.ts` can fold them with the per-vow contributions before a single write pass. Collections
 * are passed as readonly arrays (the strict wall does not treat `ReadonlyMap`/`ReadonlySet` as readonly).
 */

/** The artifacts a producer emits plus the extra primitive adapters they pull in. */
export interface Composed {
  readonly files: readonly Artifact[];
  readonly primitives: readonly string[];
}

/** Find an entity by slug among the entity vows — present only when the reference resolved (validated). */
function bySlug(entities: readonly ReadonlyVow[], slug: string): Maybe<ReadonlyVow> {
  return entities.find((entity) => entity.slug === slug);
}

/** The primitives a non-empty set of composition files pulls in, or none when nothing was emitted. */
function primitivesFor(files: readonly Artifact[], parts: readonly string[]): readonly string[] {
  if (files.length > 0) {
    return parts;
  }
  return [];
}

/** The Table parts every list composes; a select cell adds a Badge, the opt-in delete action adds a Button. */
function listPrimitives(entity: ReadonlyVow, ref: ListRef): readonly string[] {
  const parts = ["Table", "TableRow", "TableHead", "TableCell"];
  if (entity.fields.some((field) => field.type === "select")) {
    // A select cell renders as a <Badge>.
    parts.push("Badge");
  }
  if (ref.delete) {
    // The per-row delete renders as a <Button>.
    parts.push("Button");
  }
  return parts;
}

/** A view's `list: <entity>` → that entity's CRUD list (Table parts; Badge for a select cell; Button for an
 *  opt-in `actions: [delete]`). Read-only by default — the delete column appears only when the view opts in. */
export function composeLists(
  listed: readonly ListRef[],
  entities: readonly ReadonlyVow[],
  outDir: string,
): Composed {
  const index = mutableIndex(entities);
  const files: Artifact[] = [];
  const primitives = new Set<string>();
  for (const ref of listed) {
    const entity = bySlug(entities, ref.of);
    if (defined(entity)) {
      files.push({
        path: path.join(outDir, `${viewComponentName(mutable(entity))}.vue`),
        source: emitEntityList(mutable(entity), index, { delete: ref.delete }),
      });
      for (const part of listPrimitives(entity, ref)) {
        primitives.add(part);
      }
    }
  }
  return { files, primitives: [...primitives] };
}

/** A view's `stats: { of, by }` → a counts-by-field composition (the Stats/Stat primitives). */
export function composeStats(
  refs: readonly GroupRef[],
  entities: readonly ReadonlyVow[],
  outDir: string,
): Composed {
  const files: Artifact[] = [];
  for (const { of, by } of refs) {
    const entity = bySlug(entities, of);
    if (defined(entity)) {
      files.push({
        path: path.join(outDir, `${statsComponentName(of, by)}.vue`),
        source: emitEntityStats(mutable(entity), by),
      });
    }
  }
  return { files, primitives: primitivesFor(files, ["Stats", "Stat"]) };
}

/** A view's `cards: <entity>` → a card-per-record composition (the Card parts). */
export function composeCards(
  cards: readonly string[],
  entities: readonly ReadonlyVow[],
  outDir: string,
): Composed {
  const files: Artifact[] = [];
  for (const slug of cards) {
    const entity = bySlug(entities, slug);
    if (defined(entity)) {
      files.push({
        path: path.join(outDir, `${cardsComponentName(slug)}.vue`),
        source: emitEntityCards(mutable(entity)),
      });
    }
  }
  return { files, primitives: primitivesFor(files, ["Card", "CardHeader", "CardBody"]) };
}

/** A view's `board: { of, by }` → a kanban composition (the Card parts). */
export function composeBoards(
  refs: readonly GroupRef[],
  entities: readonly ReadonlyVow[],
  outDir: string,
): Composed {
  const files: Artifact[] = [];
  for (const { of, by } of refs) {
    const entity = bySlug(entities, of);
    if (defined(entity)) {
      files.push({
        path: path.join(outDir, `${boardComponentName(of, by)}.vue`),
        source: emitEntityBoard(mutable(entity), by),
      });
    }
  }
  return { files, primitives: primitivesFor(files, ["Card", "CardHeader", "CardBody"]) };
}

/** The git-timeline cache slot: `git log` is expensive; re-shell only when HEAD moved (a commit), not on
 *  every file-save HMR — `headCommit` (a cheap `rev-parse`) gates it. Keyed by `srcDir` for a multi-app
 *  dev server. */
/** The git timeline — a readonly array of `gitTimeline`'s entries (no extra import for the element type). */
type Timeline = readonly ReturnType<typeof gitTimeline>[number][];

export interface TimelineCache {
  readonly head: string;
  readonly srcDir: string;
  readonly timeline: Timeline;
}

/** Whether `cache` is a hit for `srcDir` at `head` — the invalidation decision, pure + tested directly. */
export function timelineHit(
  cache: Maybe<TimelineCache>,
  srcDir: string,
  head: string,
): cache is TimelineCache {
  return defined(cache) && cache.srcDir === srcDir && cache.head === head;
}

const timelineState: { cache: Maybe<TimelineCache> } = { cache: NONE };

/** The git timeline for `srcDir`, cached by HEAD — skips the expensive `git log` when no commit landed. */
function cachedTimeline(srcDir: string): Timeline {
  const head = headCommit(srcDir);
  const { cache } = timelineState;
  if (timelineHit(cache, srcDir, head)) {
    return cache.timeline;
  }
  const timeline = gitTimeline(srcDir);
  timelineState.cache = { head, srcDir, timeline };
  return timeline;
}

/** A `timeline:` view → the git-derived VowTimeline, baked from `git log` (cached by HEAD across HMR). */
export function composeTimeline(needsTimeline: boolean, srcDir: string, outDir: string): Composed {
  if (!needsTimeline) {
    return { files: [], primitives: [] };
  }
  return {
    files: [
      {
        path: path.join(outDir, "VowTimeline.vue"),
        source: emitTimelineSfc(cachedTimeline(srcDir), gitRemoteUrl(srcDir)),
      },
    ],
    // The timeline composes Badge + Collapsible.
    primitives: ["Badge", "Collapsible"],
  };
}

/** The live GitHub issue views (`issues: { as }`) — fixed components reading `/__vow/issues`. */
export function composeIssueViews(issueViews: readonly string[], outDir: string): Composed {
  const wanted = new Set(issueViews);
  const files: Artifact[] = [];
  if (wanted.has("table")) {
    files.push({ path: path.join(outDir, "VowIssueTable.vue"), source: emitIssueTableSfc() });
  }
  if (wanted.has("board")) {
    files.push({ path: path.join(outDir, "VowIssueBoard.vue"), source: emitIssueBoardSfc() });
  }
  if (wanted.has("roadmap")) {
    files.push({ path: path.join(outDir, "VowIssueRoadmap.vue"), source: emitIssueRoadmapSfc() });
  }
  // Each issue view composes Badge (status + labels) + Button (the close/reopen action).
  return { files, primitives: primitivesFor(files, ["Badge", "Button"]) };
}

/** The live event-feed views (`events: { as }`) — fixed components reading `/__vow/events`. */
export function composeEventViews(eventViews: readonly string[], outDir: string): Composed {
  const wanted = new Set(eventViews);
  const files: Artifact[] = [];
  if (wanted.has("trace")) {
    files.push({ path: path.join(outDir, "VowEventTrace.vue"), source: emitEventTraceSfc() });
  }
  // The trace view is self-contained (no primitive adapters beyond what the SFC renders directly).
  return { files, primitives: [] };
}

/** Materialise every needed primitive adapter once, from the closed registry (on demand → lean output). */
export function composePrimitives(needed: readonly string[], outDir: string): readonly Artifact[] {
  const files: Artifact[] = [];
  for (const name of new Set(needed)) {
    const emit = PRIMITIVE_ADAPTERS[name];
    if (defined(emit)) {
      files.push({ path: path.join(outDir, `${name}.vue`), source: emit() });
    }
  }
  return files;
}

/** A `## view` imports `./<Primitive>.vue`; emit the layout primitives so those resolve (and type-check). */
export function composeLayout(needsLayout: boolean, outDir: string): readonly Artifact[] {
  if (!needsLayout) {
    return [];
  }
  return layoutSfcs().map(({ name, sfc }) => ({
    path: path.join(outDir, `${name}.vue`),
    source: sfc,
  }));
}
