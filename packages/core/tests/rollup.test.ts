import { expect, test } from "vite-plus/test";
import type { ReadonlyVow } from "../src/readonly.ts";
import { deriveStatus } from "../src/rollup.ts";

/** A minimal vow; override only what a case needs. */
const vow = (over: Partial<ReadonlyVow> = {}): ReadonlyVow => ({
  children: [],
  fields: [],
  id: "vow_x",
  intent: "a vow",
  proof: [],
  slug: "x",
  ...over,
});
const all = (): boolean => true;
const none = (): boolean => false;
const covers =
  (...claims: readonly string[]) =>
  (claim: string): boolean =>
    claims.includes(claim);

test("a leaf with no proof is done — it exists and compiles", () => {
  expect(deriveStatus(vow(), none)).toBe("done");
});

test("a leaf is done when every claim is covered, active when some, planned when none", () => {
  const leaf = vow({ proof: [{ claim: "discounts from 10" }, { claim: "no discount under 10" }] });
  expect(deriveStatus(leaf, all)).toBe("done");
  expect(deriveStatus(leaf, covers("discounts from 10"))).toBe("active");
  expect(deriveStatus(leaf, none)).toBe("planned");
});

test("a parent rolls up its children", () => {
  const parent = vow({
    children: [vow({ proof: [{ claim: "a" }] }), vow({ proof: [{ claim: "b" }] })],
  });
  // Both children done.
  expect(deriveStatus(parent, all)).toBe("done");
  // One done, one planned.
  expect(deriveStatus(parent, covers("a"))).toBe("active");
  // Both planned.
  expect(deriveStatus(parent, none)).toBe("planned");
});

test("a parent's own proof counts alongside its children", () => {
  const parent = vow({ children: [vow({ proof: [{ claim: "c" }] })], proof: [{ claim: "p" }] });
  expect(deriveStatus(parent, covers("p", "c"))).toBe("done");
  // Own done, child planned.
  expect(deriveStatus(parent, covers("p"))).toBe("active");
  expect(deriveStatus(parent, none)).toBe("planned");
});
