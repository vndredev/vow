// @vitest-environment node
import {
  addDep,
  addItem,
  listDeps,
  listItems,
  loadSnapshot,
  migratePlan,
  planJsonlPath,
  planSnapshotJsonl,
  restoreFromJsonl,
  setStatus,
  writeSnapshot,
} from "../src/index.ts";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { expect, test } from "vite-plus/test";
import { isRecord } from "@vow/core";
import { openDb } from "@vow/db";
import path from "node:path";
import { tmpdir } from "node:os";

/** A fresh in-memory plan DB with the tables migrated. */
function freshDb(): ReturnType<typeof openDb> {
  const db = openDb(":memory:");
  migratePlan(db);
  return db;
}

/** A seeded plan — two items (one depending on the other) — the fixture the round-trip rebuilds. */
function seeded(): ReturnType<typeof openDb> {
  const db = freshDb();
  const top = addItem(db, { issue: 1, pillar: "pillar:mechanical-integrity", title: "top" });
  const dep = addItem(db, { title: "dep" });
  setStatus(db, top.id, "ready");
  addDep(db, dep.id, top.id);
  return db;
}

/** The two items in the seeded plan + the one dependency edge — the counts the assertions read. */
const ITEM_COUNT = 2;
const DEP_COUNT = 1;

/** Read a string field off one parsed NDJSON line — "" when the line is not a record or the field absent. */
function field(line: string, key: string): string {
  const parsed: unknown = JSON.parse(line);
  if (isRecord(parsed)) {
    const value = parsed[key];
    if (typeof value === "string") {
      return value;
    }
  }
  return "";
}

/** The keys of one parsed NDJSON line — empty when it is not a record. */
function keysOf(line: string): readonly string[] {
  const parsed: unknown = JSON.parse(line);
  if (isRecord(parsed)) {
    return Object.keys(parsed);
  }
  return [];
}

/** Compare two strings by UTF-16 code unit — the locale-independent sort the assertions check against. */
function compareStr(left: string, right: string): number {
  return Number(left > right) - Number(left < right);
}

test("planSnapshotJsonl is deterministic — same db yields the identical string", () => {
  const db = seeded();
  expect(planSnapshotJsonl(db)).toBe(planSnapshotJsonl(db));
});

test("planSnapshotJsonl writes items before deps, items sorted by id, with a trailing newline", () => {
  const jsonl = planSnapshotJsonl(seeded());
  expect(jsonl.endsWith("\n")).toBe(true);
  const lines = jsonl.trimEnd().split("\n");
  expect(lines.map((line) => field(line, "kind"))).toEqual(["item", "item", "dep"]);
  const itemIds = lines.slice(0, ITEM_COUNT).map((line) => field(line, "id"));
  expect(itemIds).toEqual(itemIds.toSorted(compareStr));
});

test("each line has sorted keys so a byte-identical plan gives byte-identical lines", () => {
  const lines = planSnapshotJsonl(seeded()).trimEnd().split("\n");
  for (const line of lines) {
    const keys = keysOf(line);
    expect(keys).toEqual(keys.toSorted(compareStr));
  }
});

test("restoreFromJsonl rebuilds listItems + listDeps into a fresh db", () => {
  const source = seeded();
  const target = freshDb();
  restoreFromJsonl(target, planSnapshotJsonl(source));
  expect(listItems(target)).toEqual(listItems(source));
  expect(listDeps(target)).toEqual(listDeps(source));
});

test("restoreFromJsonl clears the prior plan before rebuilding (it is the whole plan)", () => {
  const target = freshDb();
  addItem(target, { title: "stale — should be cleared" });
  restoreFromJsonl(target, planSnapshotJsonl(seeded()));
  expect(listItems(target).length).toBe(ITEM_COUNT);
  expect(listDeps(target).length).toBe(DEP_COUNT);
});

test("writeSnapshot then loadSnapshot round-trips through .vow/plan.jsonl on disk", () => {
  const root = mkdtempSync(path.join(tmpdir(), "vow-plan-"));
  try {
    const source = seeded();
    writeSnapshot(root, source);
    expect(existsSync(planJsonlPath(root))).toBe(true);
    expect(readFileSync(planJsonlPath(root), "utf8")).toBe(planSnapshotJsonl(source));
    const target = freshDb();
    expect(loadSnapshot(root, target)).toBe(true);
    expect(listItems(target)).toEqual(listItems(source));
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

test("loadSnapshot returns false when no snapshot is committed", () => {
  const root = mkdtempSync(path.join(tmpdir(), "vow-plan-"));
  try {
    expect(loadSnapshot(root, freshDb())).toBe(false);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});
