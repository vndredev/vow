import type { PlanDep, PlanItem } from "./types.ts";
import { defined } from "@vow/core";

/**
 * The ready-queue + DAG resolver — the self-planning core. The plan is a dependency graph; this resolves
 * the work the agent loop should develop NEXT: the items that are `ready` AND unblocked (every dependency
 * done), ordered by priority then position. The loop picks the RIGHT next work — unblocked, prioritized,
 * dependency-aware — not the oldest open issue. Pure (it takes the items + edges, touches nothing), so
 * the resolver is unit-tested without a DB.
 */

/** The single edge/blocker boundary — `1` named so the leverage count reads, not magic. */
const ONE = 1;

/** The ids of done items — a dependency pointing at one of these is satisfied. */
function doneIds(items: readonly PlanItem[]): readonly string[] {
  return items.filter((item) => item.status === "done").map((item) => item.id);
}

/** The dependencies of `id` not yet satisfied — the ids it depends on whose item isn't done. */
function unsatisfied(id: string, deps: readonly PlanDep[], done: readonly string[]): string[] {
  return deps
    .filter((dep) => dep.item === id && !done.includes(dep.dependsOn))
    .map((dep) => dep.dependsOn);
}

/** Higher priority first, then lower position — the ready-queue's order. */
function byRank(first: PlanItem, second: PlanItem): number {
  if (first.priority !== second.priority) {
    return second.priority - first.priority;
  }
  return first.position - second.position;
}

/**
 * The ready-queue — the items to develop next: status `ready`, every dependency done (unblocked), ordered
 * by priority (desc) then position (asc). The order the agent loop pulls from. Pure.
 */
export function readyQueue(items: readonly PlanItem[], deps: readonly PlanDep[]): PlanItem[] {
  const done = doneIds(items);
  return items
    .filter((item) => item.status === "ready" && unsatisfied(item.id, deps, done).length === 0)
    .toSorted((first, second) => byRank(first, second));
}

/**
 * The promotable set — the ids of `backlog` items whose every dependency is done (unblocked), so the loop
 * can auto-promote them to `ready` before pulling the ready-queue. The complement to `readyQueue` one
 * status down: a backlog item with no unfinished dependency is ready to be queued. Pure — the caller
 * transitions them.
 */
export function promotable(items: readonly PlanItem[], deps: readonly PlanDep[]): string[] {
  const done = doneIds(items);
  return items
    .filter((item) => item.status === "backlog" && unsatisfied(item.id, deps, done).length === 0)
    .map((item) => item.id);
}

/** A ready item held back by unfinished dependencies — what's waiting on what. */
export interface BlockedItem {
  readonly blockers: readonly string[];
  readonly item: PlanItem;
}

/**
 * The blocked set — items in `ready` status whose dependencies aren't all done yet, each with the ids
 * still blocking it. The complement of `readyQueue` among ready items: between them, every ready item is
 * either next-to-do or accounted-for-as-blocked. Pure.
 */
export function blockedItems(items: readonly PlanItem[], deps: readonly PlanDep[]): BlockedItem[] {
  const done = doneIds(items);
  const out: BlockedItem[] = [];
  for (const item of items) {
    const blockers = unsatisfied(item.id, deps, done);
    if (item.status === "ready" && blockers.length > 0) {
      out.push({ blockers, item });
    }
  }
  return out;
}

/** An item ranked by how much finishing it would free. */
export interface Leverage {
  readonly id: string;
  readonly unblocks: number;
}

/**
 * The leverage ranking — for each item, how many currently-blocked ready items it is the LAST remaining
 * blocker of (so finishing it would move them into the ready-queue). Highest first. The "do this to free
 * the most work" signal a steerer reads. Pure.
 */
export function unblocksMost(items: readonly PlanItem[], deps: readonly PlanDep[]): Leverage[] {
  const counts = new Map<string, number>();
  for (const entry of blockedItems(items, deps)) {
    const [last] = entry.blockers;
    if (entry.blockers.length === ONE && defined(last)) {
      counts.set(last, (counts.get(last) ?? 0) + ONE);
    }
  }
  const out: Leverage[] = [];
  for (const [id, unblocks] of counts) {
    out.push({ id, unblocks });
  }
  return out.toSorted((first, second) => second.unblocks - first.unblocks);
}
