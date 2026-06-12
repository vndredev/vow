import { VOW_API, dbPath } from "@vow/db/routes";
import { createList, useCollection, useIssues } from "../src/index.ts";
import { expect, test } from "vite-plus/test";
import type { PlanItem } from "@vow/observability";
import { parseIssuePlan } from "../src/issues.ts";

/** The parser's element type — what `parseIssuePlan` actually yields, pinned to the producer below. */
type Parsed = ReturnType<typeof parseIssuePlan>[number];

/** The wire shape is pinned to the producer: a parsed entry IS `@vow/observability`'s `PlanItem` (the type
 *  the `/__vow/issues` endpoint writes), so a field/status added on the producer fails the consumer's
 *  typecheck here instead of being silently downgraded. The two `extends` arms assert mutual assignability. */
type Mutual<Left, Right> = Left extends Right ? (Right extends Left ? true : false) : false;
const WIRE_TYPE_PINNED: Mutual<Parsed, PlanItem> = true;

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

test("the parsed plan IS the producer's PlanItem shape — the wire type is single-sourced", () => {
  // `WIRE_TYPE_PINNED` is `true` only when the parsed entry stays mutually assignable with `PlanItem`.
  expect(WIRE_TYPE_PINNED).toBe(true);
  const [item] = parseIssuePlan([
    { issue: { assignees: [], labels: [], number: 1, state: "open", title: "t" }, status: "done" },
  ]);
  // The parsed entry is consumable as a `PlanItem` — the round-trip the endpoint guarantees.
  const asPlanItem: PlanItem | undefined = item;
  expect(asPlanItem?.status).toBe("done");
});

test("useIssues exposes a reactive state with loading + error flags the views branch on", () => {
  const { state } = useIssues();
  expect(typeof state.loading).toBe("boolean");
  expect(typeof state.error).toBe("boolean");
});

test("the store builds its data URLs under the server's mount prefix — the shared contract holds", () => {
  // The store fetches `dbPath(slug)` / `dbPath(slug, id)`; the dev server mounts the data API on `VOW_API.db`.
  // Both ends read the one shared constant from `@vow/db/routes` — a rename cannot 404 the client.
  // Pinned here at the client end (this env has no DOM, so no live fetch fires); the round-trip lives in db.
  expect(dbPath("widget").startsWith(VOW_API.db)).toBe(true);
  expect(dbPath("widget", "1").startsWith(VOW_API.db)).toBe(true);
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
