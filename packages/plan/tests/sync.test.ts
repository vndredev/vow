// @vitest-environment node
import { addItem, applySync, listItems, migratePlan, syncActions } from "../src/index.ts";
import { expect, test } from "vite-plus/test";
import type { IssueRef } from "../src/sync.ts";
import type { PlanItem } from "../src/types.ts";
import { openDb } from "@vow/db";

const ISSUE_NEW = 10;
const ISSUE_BOUND = 20;

/** A fresh in-memory plan DB with the tables migrated. */
function freshDb(): ReturnType<typeof openDb> {
  const db = openDb(":memory:");
  migratePlan(db);
  return db;
}

/** A plan item fixture — `external`, `ready` — overridable per test. */
function item(over: Partial<PlanItem>): PlanItem {
  return {
    createdAt: "",
    id: "x",
    origin: "external",
    position: 0,
    priority: 0,
    status: "ready",
    title: "t",
    updatedAt: "",
    ...over,
  };
}

/** An issue-ref fixture — open issue #1 — overridable per test. */
function issue(over: Partial<IssueRef>): IssueRef {
  return { number: 1, state: "open", title: "t", ...over };
}

test("syncActions: an open unbound issue is ingested; an already-bound one is not", () => {
  const items = [item({ id: "a", issue: ISSUE_BOUND })];
  const issues = [issue({ number: ISSUE_NEW }), issue({ number: ISSUE_BOUND })];
  expect(syncActions(items, issues).ingest.map((each) => each.number)).toEqual([ISSUE_NEW]);
});

test("syncActions: a bound item whose issue closed (and isn't done) is closed", () => {
  const items = [item({ id: "a", issue: ISSUE_BOUND, status: "doing" })];
  const issues = [issue({ number: ISSUE_BOUND, state: "closed" })];
  expect(syncActions(items, issues).close.map((each) => each.id)).toEqual(["a"]);
});

test("applySync ingests a new open issue as backlog + closes the item of a closed issue", () => {
  const db = freshDb();
  const bound = addItem(db, { issue: ISSUE_BOUND, title: "bound" });
  applySync(db, listItems(db), [
    issue({ number: ISSUE_NEW, title: "fresh" }),
    issue({ number: ISSUE_BOUND, state: "closed" }),
  ]);
  const items = listItems(db);
  expect(items.find((found) => found.issue === ISSUE_NEW)?.status).toBe("backlog");
  expect(items.find((found) => found.id === bound.id)?.status).toBe("done");
});
