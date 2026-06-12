// oxlint-disable-next-line consistent-type-specifier-style -- one import; separate trips no-duplicate-imports
import { type ReadonlyField, type ReadonlyVow, isRecord } from "@vow/core";
import {
  archiveTable,
  assertColumnAbsent,
  assertColumnFree,
  assertTableFree,
  assertValuesCovered,
  bootstrap,
  convertColumn,
  get,
  insert,
  list,
  migrate,
  openDb,
  remove,
  renameColumn,
  seedEntity,
  update,
} from "../src/db.ts";
import { expect, test } from "vite-plus/test";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

// A live SQLite handle, derived from `openDb` so no separate type import is needed.
type Db = ReturnType<typeof openDb>;

// A minimal entity vow — only the parts `@vow/db` reads (slug, fields, seed).
function entity(
  slug: string,
  fields: readonly ReadonlyField[],
  seed?: readonly Readonly<Record<string, unknown>>[],
): ReadonlyVow {
  return { children: [], fields, id: `vow_${slug}`, intent: slug, proof: [], seed, slug };
}

// Read a table's column names from PRAGMA table_info, validating each row's `name` at runtime.
function columnNames(db: Db, slug: string): string[] {
  const rows: readonly Record<string, unknown>[] = db.prepare(`PRAGMA table_info("${slug}")`).all();
  const names: string[] = [];
  for (const row of rows) {
    const { name } = row;
    if (typeof name === "string") {
      names.push(name);
    }
  }
  return names;
}

const RANK = 3;

const task = entity(
  "task",
  [
    { name: "title", required: true, type: "text" },
    { name: "done", required: false, type: "boolean" },
    { name: "rank", required: false, type: "number" },
    { name: "status", options: ["todo", "done"], required: false, type: "select" },
  ],
  [{ status: "done", title: "Seeded" }],
);

test("migrate creates a table per entity, an id PK plus a column per field", () => {
  const db = openDb(":memory:");
  migrate(db, [task]);
  expect(columnNames(db, "task")).toEqual(["id", "title", "done", "rank", "status"]);
});

test("insert + list round-trips — boolean as a real JS bool, number as a number, defaults applied", () => {
  const db = openDb(":memory:");
  migrate(db, [task]);
  const row = insert(db, task, { done: true, rank: RANK, title: "A" });
  expect(typeof row["id"]).toBe("string");
  const [got] = list(db, task);
  expect(got?.["title"]).toBe("A");
  // INTEGER 1 decodes back to JS true.
  expect(got?.["done"]).toBe(true);
  expect(got?.["rank"]).toBe(RANK);
  // The default is the first select option.
  expect(got?.["status"]).toBe("todo");
});

test("renameColumn carries the stored data to the new column name (so a rename is non-destructive)", () => {
  const db = openDb(":memory:");
  migrate(db, [task]);
  insert(db, task, { title: "Carry me" });
  renameColumn(db, "task", "title", "name");
  // A no-op when source/target are equal or the source column is absent.
  renameColumn(db, "task", "name", "name");
  renameColumn(db, "task", "ghost", "phantom");
  expect(columnNames(db, "task")).toEqual(["id", "name", "done", "rank", "status"]);
  // The stored value followed the rename — read it back under the new column name.
  const renamed = entity("task", [{ name: "name", required: true, type: "text" }]);
  expect(list(db, renamed)[0]?.["name"]).toBe("Carry me");
});

test("renameColumn throws on a collision with an existing (orphaned) target column", () => {
  const db = openDb(":memory:");
  migrate(db, [task]);
  // `status` is a live column; renaming `title` onto it must throw an actionable error, never a raw
  // SQLite "duplicate column name" — so the studio can guard the vow `.md` rewrite.
  expect(() => {
    renameColumn(db, "task", "title", "status");
  }).toThrow(
    /cannot rename field to "status": an orphaned column "status" still exists — remove it first/u,
  );
  // The rename did not happen — the columns are unchanged.
  expect(columnNames(db, "task")).toEqual(["id", "title", "done", "rank", "status"]);
});

test("assertColumnFree is a no-op when the target column is free or equals the source", () => {
  const db = openDb(":memory:");
  migrate(db, [task]);
  expect(() => {
    assertColumnFree(db, "task", "title", "label");
  }).not.toThrow();
  expect(() => {
    assertColumnFree(db, "task", "title", "title");
  }).not.toThrow();
  expect(() => {
    assertColumnFree(db, "task", "title", "status");
  }).toThrow(/orphaned column "status"/u);
});

test("update patches only known fields (a stray key is dropped); remove deletes", () => {
  const db = openDb(":memory:");
  migrate(db, [task]);
  const row = insert(db, task, { title: "A" });
  update(db, task, String(row["id"]), { bogus: "x", done: true });
  expect(list(db, task)[0]?.["done"]).toBe(true);
  expect(remove(db, task, String(row["id"]))).toBe(true);
  expect(list(db, task)).toHaveLength(0);
});

test("bootstrap fills once from the seed (idempotent), defaults for absent fields", () => {
  const db = openDb(":memory:");
  migrate(db, [task]);
  bootstrap(db, [task]);
  // A second call is idempotent — it adds nothing.
  bootstrap(db, [task]);
  const rows = list(db, task);
  expect(rows).toHaveLength(1);
  expect(rows[0]?.["title"]).toBe("Seeded");
  expect(rows[0]?.["status"]).toBe("done");
  // The default for an absent boolean is false.
  expect(rows[0]?.["done"]).toBe(false);
});

test("bootstrap rolls back a partial seed so the table stays empty and a later bootstrap retries", () => {
  const db = openDb(":memory:");
  migrate(db, [task]);
  // Two records share one explicit id — the first insert lands, the second trips the PK UNIQUE
  // Constraint, so without a transaction the table would be left holding one stray row forever.
  const clashing = entity("task", task.fields, [
    { id: "dup", title: "First" },
    { id: "dup", title: "Second" },
  ]);
  expect(() => {
    bootstrap(db, [clashing]);
  }).toThrow();
  // The failed seed rolled back to empty — no permanent partial seed.
  expect(list(db, task)).toHaveLength(0);
  // The empty table self-heals — a corrected seed now lands fully.
  bootstrap(db, [task]);
  expect(list(db, task)).toHaveLength(1);
  expect(list(db, task)[0]?.["title"]).toBe("Seeded");
});

test("seedEntity is a no-op on an already-seeded table (the cross-process race's loser)", () => {
  // Two separate handles on the SAME file mirror the dev server + the MCP: both pass `bootstrap`'s
  // Outer `isEmpty` while the table is empty. `dbA` wins and commits the seed; `dbB` is the race's
  // Loser — its `seedEntity` takes the write lock, re-checks `isEmpty` INSIDE the transaction, sees
  // The committed rows, and seeds nothing (seed rows carry no `id`, so a re-seed would otherwise mint
  // Fresh UUIDs and duplicate every row).
  const dir = mkdtempSync(path.join(os.tmpdir(), "vow-db-"));
  const file = path.join(dir, "data.db");
  const dbA = openDb(file);
  const dbB = openDb(file);
  migrate(dbA, [task]);
  bootstrap(dbA, [task]);
  // The loser reaches `seedEntity` on a now-non-empty table — it must add nothing.
  seedEntity(dbB, task, task.seed ?? []);
  expect(list(dbB, task)).toHaveLength(1);
  expect(list(dbA, task)).toHaveLength(1);
});

test("migrate is additive — a new field adds its column and keeps existing rows", () => {
  const db = openDb(":memory:");
  migrate(db, [task]);
  insert(db, task, { title: "A" });
  const grown = entity("task", [...task.fields, { name: "note", required: false, type: "text" }]);
  migrate(db, [grown]);
  expect(columnNames(db, "task")).toContain("note");
  // Data is preserved across the additive migration.
  expect(list(db, grown)).toHaveLength(1);
});

test("assertColumnAbsent throws on an orphaned column the additive migrate never dropped", () => {
  const db = openDb(":memory:");
  migrate(db, [task]);
  // `status` is a live column standing in for an orphan a prior remove_field left behind — adding a
  // Field of that name must throw an actionable error, never silently adopt the orphan's stored data.
  expect(() => {
    assertColumnAbsent(db, "task", "status");
  }).toThrow(
    /cannot add field "status": an orphaned column "status" still exists — remove it first/u,
  );
  // A free name (no orphan) passes.
  expect(() => {
    assertColumnAbsent(db, "task", "note");
  }).not.toThrow();
});

test("convertColumn rebuilds a column with the new type so a text boolean re-decodes correctly", () => {
  const db = openDb(":memory:");
  const text = entity("flag", [{ name: "on", required: false, type: "text" }]);
  migrate(db, [text]);
  // A stored TEXT "false" — exactly the value a boolean retype would otherwise mis-decode (Boolean("false")
  // Is true) and store future falses as "0.0" under TEXT affinity.
  insert(db, text, { on: "false" });
  convertColumn(db, "flag", "on", "INTEGER");
  // The column is now INTEGER, so decodeField runs Boolean() over a real 0 — the row reads back false.
  const bool = entity("flag", [{ name: "on", required: false, type: "boolean" }]);
  expect(list(db, bool)[0]?.["on"]).toBe(false);
  // A future write of false lands as INTEGER 0 and round-trips false (no stale TEXT affinity).
  const row = insert(db, bool, { on: false });
  expect(get(db, bool, String(row["id"]))?.["on"]).toBe(false);
});

test("convertColumn is a no-op when the column is absent", () => {
  const db = openDb(":memory:");
  migrate(db, [task]);
  expect(() => {
    convertColumn(db, "task", "ghost", "INTEGER");
  }).not.toThrow();
  expect(columnNames(db, "task")).toEqual(["id", "title", "done", "rank", "status"]);
});

test("assertValuesCovered throws when a stored value falls outside the shrunk option set", () => {
  const db = openDb(":memory:");
  migrate(db, [task]);
  insert(db, task, { status: "done", title: "A" });
  // Shrinking the options to just ["todo"] would strand the stored "done" — the guard lists it.
  expect(() => {
    assertValuesCovered(db, "task", "status", ["todo"]);
  }).toThrow(/cannot shrink options of "status": stored done — allowed: todo/u);
  // The current set covers the stored value — no throw.
  expect(() => {
    assertValuesCovered(db, "task", "status", ["todo", "done"]);
  }).not.toThrow();
  // An absent column is a no-op (a retype away from select drops the column from the scan).
  expect(() => {
    assertValuesCovered(db, "task", "ghost", ["todo"]);
  }).not.toThrow();
});

test("archiveTable renames the table out of the way (recoverable) so a re-create starts fresh", () => {
  const db = openDb(":memory:");
  migrate(db, [task]);
  insert(db, task, { title: "Dead row" });
  archiveTable(db, "task");
  // The live table is gone; its rows survive under the archive name (never a hard DROP).
  expect(columnNames(db, "task")).toEqual([]);
  expect(columnNames(db, "_dropped_task")).toContain("title");
  // A re-created table of the same slug starts empty — the dead rows do not win.
  migrate(db, [task]);
  expect(list(db, task)).toHaveLength(0);
});

test("assertTableFree throws when a re-created slug's orphaned table still holds rows", () => {
  const db = openDb(":memory:");
  migrate(db, [task]);
  insert(db, task, { title: "Dead row" });
  expect(() => {
    assertTableFree(db, "task");
  }).toThrow(
    /cannot create entity "task": an orphaned table "task" still holds rows — remove it first/u,
  );
  // After archiving, the slug is free to re-create.
  archiveTable(db, "task");
  expect(() => {
    assertTableFree(db, "task");
  }).not.toThrow();
});

test("the seed ledger makes seeding once-ever — a delete-all is not resurrected by a later bootstrap", () => {
  const db = openDb(":memory:");
  migrate(db, [task]);
  bootstrap(db, [task]);
  expect(list(db, task)).toHaveLength(1);
  // The user deletes every record.
  remove(db, task, String(list(db, task)[0]?.["id"]));
  expect(list(db, task)).toHaveLength(0);
  // A later structure change / vow.md save re-runs bootstrap — the ledger keeps it a no-op (no resurrection).
  bootstrap(db, [task]);
  expect(list(db, task)).toHaveLength(0);
});

test("seedEntity reports whether rows applied — true on a fresh entity, false once already seeded", () => {
  const db = openDb(":memory:");
  migrate(db, [task]);
  expect(seedEntity(db, task, task.seed ?? [])).toBe(true);
  // A second call is a once-ever no-op — it reports false (the caller surfaces that to the LLM).
  expect(seedEntity(db, task, task.seed ?? [])).toBe(false);
  expect(list(db, task)).toHaveLength(1);
});

// The repo root, three levels up from this test (packages/db/tests).
const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..", "..");

// The major version segment in a semver-ish string ("24.13.2" -> "24").
const MAJOR = /^(\d+)\./u;

// The first group in a single-group regex match.
const FIRST_GROUP = 1;

// The `node-version: <n>` line CI runs on, read off the workflow.
const CI_NODE = /node-version:\s*(\d+)/u;

// Read the leading major version number out of a semver-ish string.
function major(version: string): string {
  return MAJOR.exec(version)?.[FIRST_GROUP] ?? "";
}

// Read @vow/db's own resolved `@types/node` version, or empty when the field is absent.
function resolvedTypesNodeVersion(): string {
  const pkg: unknown = JSON.parse(
    readFileSync(
      path.join(REPO_ROOT, "packages", "db", "node_modules", "@types", "node", "package.json"),
      "utf8",
    ),
  );
  if (isRecord(pkg) && typeof pkg["version"] === "string") {
    return pkg["version"];
  }
  return "";
}

// `@types/node` types Node APIs by major, so a copy ahead of the CI runtime can compile green yet
// Break at runtime: the experimental node:sqlite surface db.ts leans on shifts across Node majors.
// Guarding the @types/node resolved for @vow/db keeps it aligned to the Node version CI exercises.
test("the resolved @types/node major matches the Node version CI runs on", () => {
  const ciYml = readFileSync(path.join(REPO_ROOT, ".github", "workflows", "ci.yml"), "utf8");
  const ciMajor = CI_NODE.exec(ciYml)?.[FIRST_GROUP] ?? "";
  expect(ciMajor).not.toBe("");
  expect(major(resolvedTypesNodeVersion())).toBe(ciMajor);
});
