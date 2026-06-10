import { createList, useCollection } from "../src/index.ts";
import { expect, test } from "vite-plus/test";

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
