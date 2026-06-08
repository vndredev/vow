import { expect, test } from "vite-plus/test";
import { useCollection } from "../src/index.ts";

// The store is DB-backed via fetch; with no dev server the fetch rejects and the optimistic local array
// is the truth — exactly the shared-array + write-through semantics we unit-test here.
globalThis.fetch = (() => Promise.reject(new Error("no dev server"))) as unknown as typeof fetch;

test("useCollection shares one reactive array per slug; different slugs are separate", () => {
  const a = useCollection<{ id: string }>("widget");
  const b = useCollection<{ id: string }>("widget");
  a.append({ id: "1" });
  expect(b.items).toHaveLength(1); // same underlying array
  expect(useCollection("gadget").items).toHaveLength(0); // a different slug is its own collection
  b.removeAt(0);
  expect(a.items).toHaveLength(0);
});

test("update patches an item in place, by id", () => {
  const c = useCollection<{ id: string; n: number }>("thing");
  c.append({ id: "x", n: 1 });
  c.update("x", { n: 2 });
  expect(c.items[0]?.n).toBe(2);
});
