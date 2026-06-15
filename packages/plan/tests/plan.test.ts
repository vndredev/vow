// @vitest-environment node
import {
  addDep,
  addItem,
  canTransition,
  getItem,
  getSession,
  listDeps,
  listItems,
  migratePlan,
  nextStatuses,
  openSession,
  setStatus,
} from "../src/index.ts";
import { expect, test } from "vite-plus/test";
import { openDb } from "@vow/db";

const PRIORITY = 5;
const ISSUE = 42;
const PR = 7;

/** A fresh in-memory plan DB with the tables migrated. */
function freshDb(): ReturnType<typeof openDb> {
  const db = openDb(":memory:");
  migratePlan(db);
  return db;
}

test("lifecycle: the backlog -> ready -> doing -> review -> done path is legal; jumps are not", () => {
  expect(canTransition("backlog", "ready")).toBe(true);
  expect(canTransition("ready", "doing")).toBe(true);
  expect(canTransition("doing", "review")).toBe(true);
  expect(canTransition("review", "done")).toBe(true);
  expect(canTransition("backlog", "done")).toBe(false);
  expect(canTransition("done", "doing")).toBe(false);
  expect(nextStatuses("done")).toEqual([]);
});

test("addItem opens a backlog item; getItem + listItems read it back", () => {
  const db = freshDb();
  const item = addItem(db, {
    pillar: "pillar:self-building",
    priority: PRIORITY,
    title: "the loop",
  });
  expect(item.status).toBe("backlog");
  expect(item.pillar).toBe("pillar:self-building");
  const read = getItem(db, item.id);
  expect(read?.title).toBe("the loop");
  expect(read?.priority).toBe(PRIORITY);
  expect(listItems(db).length).toBe(1);
});

test("a local-only item has no issue; a bound item carries its number", () => {
  const db = freshDb();
  const local = addItem(db, { title: "internal" });
  expect(local.issue).toBeUndefined();
  const bound = addItem(db, { issue: ISSUE, title: "external" });
  expect(bound.issue).toBe(ISSUE);
});

test("setStatus enforces the lifecycle — a legal move stamps, an illegal one throws", () => {
  const db = freshDb();
  const item = addItem(db, { title: "x" });
  expect(setStatus(db, item.id, "ready")?.status).toBe("ready");
  expect(() => setStatus(db, item.id, "done")).toThrow(/illegal plan transition/u);
});

test("setStatus to done stamps closedAt", () => {
  const db = freshDb();
  const item = addItem(db, { title: "x" });
  setStatus(db, item.id, "ready");
  setStatus(db, item.id, "doing");
  setStatus(db, item.id, "review");
  const done = setStatus(db, item.id, "done");
  expect(done?.status).toBe("done");
  expect(done?.closedAt).toBeTruthy();
});

test("deps record the DAG edges (item blocked by dependsOn)", () => {
  const db = freshDb();
  const blocker = addItem(db, { title: "a" });
  const blocked = addItem(db, { title: "b" });
  addDep(db, blocked.id, blocker.id);
  expect(listDeps(db)).toEqual([{ dependsOn: blocker.id, item: blocked.id }]);
});

test("a session is the live claim — open then read it back, pr and all", () => {
  const db = freshDb();
  const item = addItem(db, { title: "x" });
  openSession(db, {
    branch: "feat/x",
    item: item.id,
    pr: PR,
    startedAt: "2026-06-15T00:00:00Z",
    worktree: "/wt",
  });
  const session = getSession(db, item.id);
  expect(session?.branch).toBe("feat/x");
  expect(session?.pr).toBe(PR);
});
