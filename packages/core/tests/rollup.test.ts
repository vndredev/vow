import { expect, test } from "vite-plus/test";
import { deriveStatus } from "../src/rollup.ts";
import type { Vow } from "../src/vow.ts";

/** A minimal vow; override only what a case needs. */
const vow = (over: Partial<Vow> = {}): Vow => ({
  id: "vow_x",
  slug: "x",
  intent: "a vow",
  children: [],
  fields: [],
  proof: [],
  ...over,
});
const all = (): boolean => true;
const none = (): boolean => false;
const covers =
  (...claims: string[]) =>
  (c: string): boolean =>
    claims.includes(c);

test("a leaf with no proof is done — it exists and compiles", () => {
  expect(deriveStatus(vow(), none)).toBe("done");
});

test("a leaf is done when every claim is covered, active when some, planned when none", () => {
  const v = vow({ proof: [{ claim: "discounts from 10" }, { claim: "no discount under 10" }] });
  expect(deriveStatus(v, all)).toBe("done");
  expect(deriveStatus(v, covers("discounts from 10"))).toBe("active");
  expect(deriveStatus(v, none)).toBe("planned");
});

test("a parent rolls up its children", () => {
  const v = vow({
    children: [vow({ proof: [{ claim: "a" }] }), vow({ proof: [{ claim: "b" }] })],
  });
  expect(deriveStatus(v, all)).toBe("done"); // both children done
  expect(deriveStatus(v, covers("a"))).toBe("active"); // one done, one planned
  expect(deriveStatus(v, none)).toBe("planned"); // both planned
});

test("a parent's own proof counts alongside its children", () => {
  const v = vow({ proof: [{ claim: "p" }], children: [vow({ proof: [{ claim: "c" }] })] });
  expect(deriveStatus(v, covers("p", "c"))).toBe("done");
  expect(deriveStatus(v, covers("p"))).toBe("active"); // own done, child planned
  expect(deriveStatus(v, none)).toBe("planned");
});
