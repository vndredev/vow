// oxlint-disable-next-line consistent-type-specifier-style -- one import; separate trips no-duplicate-imports
import { type ReadonlyField, type ReadonlyVow, isRecord } from "@vow/core";
import { bootstrap, insert, list, migrate, openDb, remove, update } from "../src/db.ts";
import { expect, test } from "vite-plus/test";
import path from "node:path";
import { readFileSync } from "node:fs";

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
