import { createList, useCollection, useIssues } from "../src/index.ts";
import { expect, test } from "vite-plus/test";
import { parseIssuePlan } from "../src/issues.ts";

/**
 * The store is DB-backed via fetch; with no dev server the fetch rejects and the optimistic local array
 * is the truth — exactly the shared-array + write-through semantics we unit-test here.
 */
const mockFetch: typeof fetch = async (): Promise<Response> => {
  await Promise.resolve();
  throw new Error("no dev server");
};
globalThis.fetch = mockFetch;

test("useCollection shares one reactive array per slug; different slugs are separate", () => {
  const first = useCollection<{ id: string }>("widget");
  const second = useCollection<{ id: string }>("widget");
  first.append({ id: "1" });
  // Same underlying array.
  expect(second.items).toHaveLength(1);
  // A different slug is its own collection.
  expect(useCollection("gadget").items).toHaveLength(0);
  second.removeAt(0);
  expect(first.items).toHaveLength(0);
});

test("update patches an item in place, by id", () => {
  const expectedCount = 2;
  const collection = useCollection<{ id: string; count: number }>("thing");
  collection.append({ count: 1, id: "x" });
  collection.update("x", { count: expectedCount });
  expect(collection.items[0]?.count).toBe(expectedCount);
});

test("reconcile drops a key removed upstream — no stale column lingers", () => {
  const list = createList();
  list.push({ id: "1", note: "old", title: "a" });
  // `note` is gone upstream.
  list.reconcile([{ id: "1", title: "b" }]);
  // Note dropped, title updated.
  expect(list.rows[0]).toEqual({ id: "1", title: "b" });
});

test("subscribe fires a listener on each mutation; the returned unsubscribe stops it", () => {
  const list = createList();
  const calls: string[] = [];
  const off = list.subscribe(() => {
    calls.push("fired");
  });
  list.push({ id: "1", title: "a" });
  list.update("1", { title: "b" });
  off();
  // The post-unsubscribe push must not fire.
  list.push({ id: "2", title: "c" });
  expect(calls).toEqual(["fired", "fired"]);
});

test("version rises on each mutation — the snapshot token a binding compares", () => {
  const list = createList();
  const before = list.version;
  list.push({ id: "1", title: "a" });
  expect(list.version).toBeGreaterThan(before);
});

test("parseIssuePlan carries a doing item's agent session (the open PR + url); omits a malformed one", () => {
  const plan = parseIssuePlan([
    {
      issue: { assignees: [], labels: [], number: 99, state: "open", title: "the loop" },
      session: { number: 175, url: "https://github.com/o/r/pull/175" },
      status: "doing",
    },
    {
      issue: { assignees: [], labels: [], number: 5, state: "open", title: "planned" },
      session: { url: "no number" },
      status: "planned",
    },
  ]);
  expect(plan[0]?.session).toEqual({ number: 175, url: "https://github.com/o/r/pull/175" });
  // A malformed session (no numeric `number`) is dropped, not carried.
  expect(plan[1]).not.toHaveProperty("session");
});

test("useIssues exposes a reactive state with loading + error flags the views branch on", () => {
  const { state } = useIssues();
  expect(typeof state.loading).toBe("boolean");
  expect(typeof state.error).toBe("boolean");
});

test("reconcile patches in place (keeps identity), adds new + drops missing", () => {
  const newCount = 9;
  const list = createList();
  list.push({ count: 1, id: "1" });
  const [first] = list.rows;
  list.reconcile([
    { count: 2, id: "1" },
    { count: newCount, id: "2" },
  ]);
  // Same object — an in-place patch, not a replace.
  expect(list.rows[0]).toBe(first);
  expect(list.rows.map((row: Readonly<{ id: string }>) => row.id).toSorted()).toEqual(["1", "2"]);
});
