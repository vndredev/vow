import { blockedItems, readyQueue } from "./queue.ts";
import { listDeps, listItems } from "./store.ts";
import type { Db } from "@vow/db";
import type { PlanItem } from "./types.ts";

/**
 * The plan snapshot — the one read the studio's local-plan surface renders. It composes the stored items
 * with the two derived sets the DAG resolver computes: the ready-queue (the ordered ids the loop pulls
 * next) and the blocked set (a `ready` item held back by an unfinished dependency). The Now/Backlog/Map
 * views slice `items` by status + pillar; the Next view reads `ready`, whose order isn't derivable from
 * the items alone.
 */

/** One blocked item flattened for the wire — its id + the ids still blocking it. */
export interface BlockedRef {
  readonly blockers: readonly string[];
  readonly id: string;
}

/** Every item + the derived ready-queue (ordered ids) + the blocked set — the studio's whole plan read. */
export interface PlanSnapshot {
  readonly blocked: readonly BlockedRef[];
  readonly items: readonly PlanItem[];
  readonly ready: readonly string[];
}

/** Compose the snapshot from the DB — the items plus the derived ready-queue + blocked set. */
export function planSnapshot(db: Db): PlanSnapshot {
  const items = listItems(db);
  const deps = listDeps(db);
  const ready = readyQueue(items, deps).map((item) => item.id);
  const blocked = blockedItems(items, deps).map((entry) => ({
    blockers: entry.blockers,
    id: entry.item.id,
  }));
  return { blocked, items, ready };
}
