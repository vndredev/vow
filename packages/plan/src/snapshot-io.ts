/* oxlint-disable consistent-type-specifier-style -- mixed type+value from ./location; a split import trips no-duplicate-imports */
import type { PlanDep, PlanItem, PlanOrigin, PlanStatus } from "./types.ts";
import { addDep, clearPlan, insertItem, listDeps, listItems } from "./store.ts";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { type openPlan, planJsonlPath } from "./location.ts";
import { isRecord } from "@vow/core";
import path from "node:path";
/* oxlint-enable consistent-type-specifier-style */

/**
 * The committed plan snapshot's file I/O — the round-trip between the gitignored `.vow/plan.db` (the
 * per-machine runtime index) and the git-tracked `.vow/plan.jsonl` (the versioned, PR-reviewed plan). Only
 * the items + dependency edges are snapshotted; sessions + events are runtime state that never leaves the
 * machine. The NDJSON is deterministic (sorted rows, sorted keys) so a byte-identical plan yields an
 * identical file — a clean git diff. On a fresh clone `loadSnapshot` regenerates the db from the file
 * (then the live issues sync on top).
 */

/** The plan db handle — `openPlan`'s return, aliased so this module needs no `@vow/db` dependency. */
type PlanDb = ReturnType<typeof openPlan>;

/** The empty string — the absent-text default + the "no pillar/closedAt" sentinel on parse. */
const EMPTY = "";

/** The 0 an absent issue stores (real issue numbers are >= 1, so 0 reads back as absence). */
const ABSENT_NUM = 0;

/** The known plan statuses — the allow-list a parsed string narrows against (no `as`). */
const STATUSES: readonly PlanStatus[] = [
  "backlog",
  "blocked",
  "doing",
  "done",
  "parked",
  "ready",
  "review",
];

/** The known origins — the allow-list a parsed string narrows against. */
const ORIGINS: readonly PlanOrigin[] = ["external", "internal", "user"];

/** A parsed value as a string, or `fallback` when it is not one. */
function asString(value: unknown, fallback: string): string {
  if (typeof value === "string") {
    return value;
  }
  return fallback;
}

/** A parsed value as a number, or `0` when it is not one. */
function asNumber(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }
  return ABSENT_NUM;
}

/** A parsed string narrowed to a `PlanStatus`, defaulting to `backlog` on an unknown value. */
function toStatus(value: unknown): PlanStatus {
  for (const status of STATUSES) {
    if (status === value) {
      return status;
    }
  }
  return "backlog";
}

/** A parsed string narrowed to a `PlanOrigin`, defaulting to `internal` on an unknown value. */
function toOrigin(value: unknown): PlanOrigin {
  for (const origin of ORIGINS) {
    if (origin === value) {
      return origin;
    }
  }
  return "internal";
}

/** The optional `issue` fragment — present only when a positive number is parsed (the spread keeps the
 *  absent case free of an `undefined` literal). */
function optIssue(value: unknown): { issue?: number } {
  if (typeof value === "number" && value > ABSENT_NUM) {
    return { issue: value };
  }
  return {};
}

/** The optional `pillar` fragment — present only when a non-empty string is parsed. */
function optPillar(value: unknown): { pillar?: string } {
  if (typeof value === "string" && value !== EMPTY) {
    return { pillar: value };
  }
  return {};
}

/** The optional `closedAt` fragment — present only when a non-empty string is parsed. */
function optClosedAt(value: unknown): { closedAt?: string } {
  if (typeof value === "string" && value !== EMPTY) {
    return { closedAt: value };
  }
  return {};
}

/** A parsed record to a `PlanItem` — every field narrowed defensively (no cast), the optionals via
 *  spread-fragments so an absent value writes no `undefined` literal. */
function toItem(record: Readonly<Record<string, unknown>>): PlanItem {
  return {
    createdAt: asString(record["createdAt"], EMPTY),
    id: asString(record["id"], EMPTY),
    origin: toOrigin(record["origin"]),
    position: asNumber(record["position"]),
    priority: asNumber(record["priority"]),
    status: toStatus(record["status"]),
    title: asString(record["title"], EMPTY),
    updatedAt: asString(record["updatedAt"], EMPTY),
    ...optIssue(record["issue"]),
    ...optPillar(record["pillar"]),
    ...optClosedAt(record["closedAt"]),
  };
}

/** Serialize one object as a JSON line with SORTED keys — byte-identical objects produce identical lines. */
function jsonLine(obj: Readonly<Record<string, unknown>>): string {
  return JSON.stringify(obj, Object.keys(obj).toSorted());
}

/** One `item` line — the stored item tagged `kind: "item"` (each optional already absent or present). */
function itemLine(item: PlanItem): string {
  return jsonLine({ kind: "item", ...item });
}

/** One `dep` line — a dependency edge tagged `kind: "dep"`. */
function depLine(dep: PlanDep): string {
  return jsonLine({ dependsOn: dep.dependsOn, item: dep.item, kind: "dep" });
}

/** Compare two strings by UTF-16 code unit — branchless (no ternary) and locale-INDEPENDENT, so the order
 *  is byte-stable across machines (`localeCompare` is not). `-1`/`0`/`1` for less/equal/greater. */
function compareStr(left: string, right: string): number {
  return Number(left > right) - Number(left < right);
}

/** Order deps deterministically — by `item`, then `dependsOn` — so the snapshot's diff is stable. */
function byDep(left: PlanDep, right: PlanDep): number {
  return compareStr(left.item, right.item) || compareStr(left.dependsOn, right.dependsOn);
}

/** Order items deterministically — by `id` — so the snapshot's diff is stable. */
function byId(left: PlanItem, right: PlanItem): number {
  return compareStr(left.id, right.id);
}

/**
 * Serialize the plan's items + dependency edges as DETERMINISTIC NDJSON: items (sorted by id) then deps
 * (sorted by item, dependsOn), one sorted-key JSON object per line, each tagged `kind`. A byte-identical
 * plan yields an identical string, so the committed snapshot's git diff stays clean. Trailing newline.
 */
export function planSnapshotJsonl(db: PlanDb): string {
  const items = listItems(db).toSorted(byId);
  const deps = listDeps(db).toSorted(byDep);
  const lines = [...items.map((item) => itemLine(item)), ...deps.map((dep) => depLine(dep))];
  return `${lines.join("\n")}\n`;
}

/** Restore one parsed line into the db — an `item` line inserts the item (carrying its stored id), a `dep`
 *  line adds the edge. An unrecognized `kind` is ignored. */
function restoreLine(db: PlanDb, record: Readonly<Record<string, unknown>>): void {
  const { kind } = record;
  if (kind === "item") {
    insertItem(db, toItem(record));
    return;
  }
  if (kind === "dep") {
    addDep(db, asString(record["item"], EMPTY), asString(record["dependsOn"], EMPTY));
  }
}

/**
 * Rebuild the plan from a snapshot's NDJSON — `clearPlan` first (the file is the whole plan), then parse
 * each non-empty line through `isRecord` (never a cast on `JSON.parse`'s `unknown`) and restore it. Items
 * carry their stored id; deps rebuild the DAG. Sessions + events are untouched (runtime state).
 */
export function restoreFromJsonl(db: PlanDb, jsonl: string): void {
  clearPlan(db);
  const lines = jsonl.split("\n").filter((line) => line.trim() !== EMPTY);
  for (const line of lines) {
    const parsed: unknown = JSON.parse(line);
    if (isRecord(parsed)) {
      restoreLine(db, parsed);
    }
  }
}

/**
 * Write the committed snapshot ATOMICALLY — serialize to `<plan.jsonl>.tmp`, then `renameSync` it onto
 * `plan.jsonl`. Rename is atomic within one filesystem, so a concurrent reader never sees a half-written
 * file.
 */
export function writeSnapshot(root: string, db: PlanDb): void {
  const target = planJsonlPath(root);
  const tmp = `${target}.tmp`;
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(tmp, planSnapshotJsonl(db));
  renameSync(tmp, target);
}

/**
 * Load the committed snapshot into the db — when `plan.jsonl` exists, rebuild the plan from it and return
 * true; otherwise return false (the no-snapshot case). The fresh-clone bootstrap: regenerate the db from
 * the git-tracked file before the live issues sync on top.
 */
export function loadSnapshot(root: string, db: PlanDb): boolean {
  const target = planJsonlPath(root);
  if (!existsSync(target)) {
    return false;
  }
  restoreFromJsonl(db, readFileSync(target, "utf8"));
  return true;
}
