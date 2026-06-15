// @vitest-environment node
import { addDep, addItem, migratePlan, planSnapshot, setStatus } from "../src/index.ts";
import { expect, test } from "vite-plus/test";
import { openDb } from "@vow/db";

/** A fresh in-memory plan DB with the tables migrated. */
function freshDb(): ReturnType<typeof openDb> {
  const db = openDb(":memory:");
  migratePlan(db);
  return db;
}

const TWO = 2;

test("planSnapshot composes items + the ready-queue + the blocked set", () => {
  const db = freshDb();
  const top = addItem(db, { title: "top" });
  const dep = addItem(db, { title: "dep" });
  setStatus(db, top.id, "ready");
  setStatus(db, dep.id, "ready");
  addDep(db, dep.id, top.id);
  const snap = planSnapshot(db);
  expect(snap.items.length).toBe(TWO);
  expect(snap.ready).toEqual([top.id]);
  expect(snap.blocked.map((each) => each.id)).toEqual([dep.id]);
});
