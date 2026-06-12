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

/** An arbitrary issue number for the start-work signal test (a named constant, not a magic literal). */
const SOME_ISSUE = 42;

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

test("removeById deletes the row carrying that id — never the displayed index", () => {
  const list = createList();
  list.push({ id: "a", title: "first" });
  list.push({ id: "b", title: "second" });
  list.push({ id: "c", title: "third" });
  // Delete the MIDDLE row by id; the surrounding rows survive (a sorted/grouped view's index would differ).
  expect(list.removeById("b")).toBe("b");
  expect(list.rows.map((row: Readonly<{ id: string }>) => row.id)).toEqual(["a", "c"]);
});

test("removeById is a no-op for an unknown id — nothing is removed", () => {
  const list = createList();
  list.push({ id: "a", title: "first" });
  expect(list.removeById("missing")).toBeUndefined();
  expect(list.rows).toHaveLength(1);
});

test("the collection's removeById writes through by id (the list's per-row delete path)", () => {
  const collection = useCollection<{ id: string; title: string }>("notes");
  collection.append({ id: "n1", title: "keep" });
  collection.append({ id: "n2", title: "drop" });
  collection.removeById("n1");
  // The first row went, the second stayed — the delete keyed off the id, not position 0.
  expect(collection.items.map((row: Readonly<{ id: string }>) => row.id)).toEqual(["n2"]);
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

test("subscribe fires on every mutation KIND — push, reconcile, update, removeById, removeAt", () => {
  // The framework-neutral seam (useSyncExternalStore subscribe / a Solid signal) must wake on each path.
  const expectedFires = 6;
  const list = createList();
  let fires = 0;
  list.subscribe(() => {
    fires += 1;
  });
  // One mutation of each kind: append, freshness pull, patch by id, append, delete by id, delete by index.
  const mutate = (): void => {
    list.push({ id: "1", title: "a" });
    list.reconcile([{ id: "1", title: "b" }]);
    list.update("1", { title: "c" });
    list.push({ id: "2", title: "d" });
    list.removeById("2");
    list.removeAt(0);
  };
  mutate();
  expect(fires).toBe(expectedFires);
});

test("getSnapshot is referentially stable BETWEEN mutations — the useSyncExternalStore invariant", () => {
  // UseSyncExternalStore loops forever if getSnapshot returns a fresh value with no mutation in between.
  const list = createList();
  const before = list.getSnapshot();
  expect(list.getSnapshot()).toBe(before);
  // A mutation moves the snapshot; a fresh read after it is stable again.
  list.push({ id: "1", title: "a" });
  const after = list.getSnapshot();
  expect(after).not.toBe(before);
  expect(list.getSnapshot()).toBe(after);
});

test("getSnapshot rises on each mutation and equals version — the snapshot token a binding compares", () => {
  const list = createList();
  const before = list.getSnapshot();
  list.push({ id: "1", title: "a" });
  expect(list.getSnapshot()).toBeGreaterThan(before);
  // GetSnapshot and version are the same token, named for the framework contract.
  expect(list.getSnapshot()).toBe(list.version);
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

test("useCollection exposes a reactive state — the list tells loading apart from genuinely empty", () => {
  // The generated entity list reads this to gate "Nothing here yet." behind !loading && !error, so the
  // First /__vow/db fetch no longer reads as empty. Two readers of one slug share the same state instance.
  const { state } = useCollection<{ id: string }>("project");
  expect(typeof state.loading).toBe("boolean");
  expect(typeof state.error).toBe("boolean");
  expect(useCollection<{ id: string }>("project").state).toBe(state);
});

test("useIssues exposes startWork — the board action's signal to the agent — a safe no-op without a server", () => {
  const { startWork } = useIssues();
  expect(typeof startWork).toBe("function");
  // No DOM / dev server here, so the POST is skipped and the call must not throw. The dev-API test drives
  // The live POST end to end (signal -> /__vow/agent -> dispatch the run).
  expect(() => {
    startWork(SOME_ISSUE);
  }).not.toThrow();
});

test("the store builds its data URLs under the server's mount prefix — the shared contract holds", () => {
  // The store fetches `dbPath(slug)` / `dbPath(slug, id)`; the dev server mounts the data API on `VOW_API.db`.
  // Both ends read the one shared constant from `@vow/db/routes` — a rename cannot 404 the client.
  // Pinned here at the client end (this env has no DOM, so no live fetch fires); the round-trip lives in db.
  expect(dbPath("widget").startsWith(VOW_API.db)).toBe(true);
  expect(dbPath("widget", "1").startsWith(VOW_API.db)).toBe(true);
});

test("a pending update is not reverted by a reconcile against still-stale rows", () => {
  const list = createList();
  list.push({ id: "1", title: "old" });
  // The user edits; the optimistic write is in flight (markPending), the DB still has the old value.
  list.update("1", { title: "new" });
  list.markPending("1");
  list.reconcile([{ id: "1", title: "old" }]);
  // The edit survives — reconcile skipped the pending row instead of overwriting it (no flicker).
  expect(list.rows[0]).toEqual({ id: "1", title: "new" });
  // Once the write settles the next poll reconciles normally.
  list.clearPending("1");
  list.reconcile([{ id: "1", title: "new" }]);
  expect(list.rows[0]).toEqual({ id: "1", title: "new" });
});

test("a pending append is not dropped by a reconcile that has not seen it yet", () => {
  const list = createList();
  // The user appends; the optimistic POST is in flight, so the fetched set has no such row yet.
  list.push({ id: "new1", title: "draft" });
  list.markPending("new1");
  list.reconcile([]);
  // The appended row survives — reconcile skipped the drop for the pending id (no flicker).
  expect(list.rows.map((row: Readonly<{ id: string }>) => row.id)).toEqual(["new1"]);
  // After the POST settles, a fetch that now includes it reconciles in place (no duplicate).
  list.clearPending("new1");
  list.reconcile([{ id: "new1", title: "draft" }]);
  expect(list.rows.map((row: Readonly<{ id: string }>) => row.id)).toEqual(["new1"]);
});

test("a pending delete is not re-added by a reconcile that still returns the row", () => {
  const list = createList();
  list.push({ id: "gone", title: "removed" });
  // The user deletes; the optimistic DELETE is in flight, so the fetch still returns the row.
  list.removeById("gone");
  list.markPending("gone");
  list.reconcile([{ id: "gone", title: "removed" }]);
  // The row stays gone — reconcile skipped re-adding the pending-deleted id (no flicker).
  expect(list.rows).toHaveLength(0);
});

test("reconcile against byte-identical rows is a no-op — no snapshot churn, no listener fires", () => {
  // The #403 getSnapshot token must change only on a real mutation; a 5s freshness poll that returns the
  // Live rows unchanged must not bump it (else useSyncExternalStore consumers re-render every poll forever).
  const list = createList();
  list.push({ id: "1", note: "n", title: "a" });
  list.push({ id: "2", note: "m", title: "b" });
  const before = list.getSnapshot();
  let fires = 0;
  list.subscribe(() => {
    fires += 1;
  });
  // Same ids, same key set, same values — a brand-new array each but structurally identical.
  list.reconcile([
    { id: "1", note: "n", title: "a" },
    { id: "2", note: "m", title: "b" },
  ]);
  // The token did not move and no listener fired.
  expect(list.getSnapshot()).toBe(before);
  expect(fires).toBe(0);
});

test("reconcile notifies once when only one survivor's value actually changed", () => {
  const list = createList();
  list.push({ id: "1", title: "a" });
  list.push({ id: "2", title: "b" });
  const before = list.getSnapshot();
  let fires = 0;
  list.subscribe(() => {
    fires += 1;
  });
  // Row 2 changes, row 1 is identical — a real change, so exactly one notify.
  list.reconcile([
    { id: "1", title: "a" },
    { id: "2", title: "changed" },
  ]);
  expect(list.getSnapshot()).toBeGreaterThan(before);
  expect(fires).toBe(1);
  expect(list.rows.map((row: Readonly<Record<string, unknown>>) => row["title"])).toEqual([
    "a",
    "changed",
  ]);
});

test("reconcile counts a dropped column as a change — the key-set diff still notifies", () => {
  // The drop-stale-column behavior (store.test.ts:75) must keep counting as a change even though every
  // Surviving value is equal: the key SET shrank, so getSnapshot moves and the listener fires.
  const list = createList();
  list.push({ id: "1", note: "old", title: "a" });
  const before = list.getSnapshot();
  let fires = 0;
  list.subscribe(() => {
    fires += 1;
  });
  // `note` is gone upstream; `title` is unchanged.
  list.reconcile([{ id: "1", title: "a" }]);
  expect(list.rows[0]).toEqual({ id: "1", title: "a" });
  expect(list.getSnapshot()).toBeGreaterThan(before);
  expect(fires).toBe(1);
});

test("reconcile notifies on a pure drop (a row vanished upstream) and a pure append (a brand-new row)", () => {
  const list = createList();
  list.push({ id: "1", title: "a" });
  // A pure drop: id 1 is gone upstream.
  const beforeDrop = list.getSnapshot();
  list.reconcile([]);
  expect(list.getSnapshot()).toBeGreaterThan(beforeDrop);
  // A pure append: a brand-new id arrives.
  const beforeAppend = list.getSnapshot();
  list.reconcile([{ id: "2", title: "b" }]);
  expect(list.getSnapshot()).toBeGreaterThan(beforeAppend);
  expect(list.rows.map((row: Readonly<{ id: string }>) => row.id)).toEqual(["2"]);
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
