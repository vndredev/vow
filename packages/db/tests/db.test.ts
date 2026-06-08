import { expect, test } from "vite-plus/test";
import type { Vow } from "@vow/core";
import { bootstrap, insert, list, migrate, openDb, remove, update } from "../src/db.ts";

// A minimal entity vow — only the parts `@vow/db` reads (slug, fields, seed).
function entity(slug: string, fields: Vow["fields"], seed?: Vow["seed"]): Vow {
  return { id: `vow_${slug}`, slug, intent: slug, children: [], fields, proof: [], seed } as Vow;
}

const task = entity(
  "task",
  [
    { name: "title", type: "text", required: true },
    { name: "done", type: "boolean", required: false },
    { name: "rank", type: "number", required: false },
    { name: "status", type: "select", required: false, options: ["todo", "done"] },
  ],
  [{ title: "Seeded", status: "done" }],
);

test("migrate creates a table per entity, an id PK plus a column per field", () => {
  const db = openDb(":memory:");
  migrate(db, [task]);
  const cols = (db.prepare(`PRAGMA table_info("task")`).all() as { name: string }[]).map(
    (c) => c.name,
  );
  expect(cols).toEqual(["id", "title", "done", "rank", "status"]);
});

test("insert + list round-trips — boolean as a real JS bool, number as a number, defaults applied", () => {
  const db = openDb(":memory:");
  migrate(db, [task]);
  const row = insert(db, task, { title: "A", done: true, rank: 3 });
  expect(typeof row["id"]).toBe("string");
  const [got] = list(db, task);
  expect(got?.["title"]).toBe("A");
  expect(got?.["done"]).toBe(true); // INTEGER 1 → JS true
  expect(got?.["rank"]).toBe(3);
  expect(got?.["status"]).toBe("todo"); // default = the first select option
});

test("update patches only known fields (a stray key is dropped); remove deletes", () => {
  const db = openDb(":memory:");
  migrate(db, [task]);
  const row = insert(db, task, { title: "A" });
  update(db, task, String(row["id"]), { done: true, bogus: "x" });
  expect(list(db, task)[0]?.["done"]).toBe(true);
  expect(remove(db, task, String(row["id"]))).toBe(true);
  expect(list(db, task)).toHaveLength(0);
});

test("bootstrap fills once from the seed (idempotent), defaults for absent fields", () => {
  const db = openDb(":memory:");
  migrate(db, [task]);
  bootstrap(db, [task]);
  bootstrap(db, [task]); // idempotent — a second call adds nothing
  const rows = list(db, task);
  expect(rows).toHaveLength(1);
  expect(rows[0]?.["title"]).toBe("Seeded");
  expect(rows[0]?.["status"]).toBe("done");
  expect(rows[0]?.["done"]).toBe(false); // default for an absent boolean
});

test("migrate is additive — a new field adds its column and keeps existing rows", () => {
  const db = openDb(":memory:");
  migrate(db, [task]);
  insert(db, task, { title: "A" });
  const grown = entity("task", [...task.fields, { name: "note", type: "text", required: false }]);
  migrate(db, [grown]);
  const cols = (db.prepare(`PRAGMA table_info("task")`).all() as { name: string }[]).map(
    (c) => c.name,
  );
  expect(cols).toContain("note");
  expect(list(db, grown)).toHaveLength(1); // data preserved
});
