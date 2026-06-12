import { Field, Vow } from "../src/index.ts";
import { expect, test } from "vite-plus/test";

const leaf = {
  fulfills: { export: "Vow", kind: "bind", module: "@vow/core" },
  id: "vow_core",
  intent: "The vow model as one recursive primitive",
  proof: [{ claim: "a vow validates recursively" }],
  slug: "vow-model",
};

test("a vow validates, recursively (children are vows)", () => {
  const root = {
    children: [leaf],
    id: "vow_root",
    intent: "Build apps from specs, drift-free",
    slug: "vow",
  };
  const parsed = Vow.parse(root);
  expect(parsed.children[0]?.slug).toBe("vow-model");
  expect(parsed.children).toHaveLength(1);
});

test("fulfilment is emit OR bind — and nothing else", () => {
  const emit = Vow.safeParse({
    fulfills: { as: "view", kind: "emit" },
    id: "vow_v",
    intent: "A kanban view",
    slug: "kanban",
  });
  expect(emit.success).toBe(true);
  const bind = Vow.safeParse({
    fulfills: { export: "rollup", kind: "bind", module: "@vow/core" },
    id: "vow_b",
    intent: "Status roll-up",
    slug: "rollup",
  });
  expect(bind.success).toBe(true);
  const bogus = Vow.safeParse({
    fulfills: { kind: "magic" },
    id: "vow_x",
    intent: "bogus fulfilment",
    slug: "x",
  });
  expect(bogus.success).toBe(false);
});

test("a vow stores NO status (status is derived, never stored)", () => {
  const parsed = Vow.parse({ id: "vow_s", intent: "status is derived", slug: "no-status" });
  expect("status" in parsed).toBe(false);
});

test("a pure-composition vow needs no fulfilment", () => {
  const grouping = Vow.safeParse({
    children: [leaf],
    id: "vow_g",
    intent: "A grouping epic",
    slug: "epic",
  });
  expect(grouping.success).toBe(true);
});

test("references use immutable ids, labels are kebab-case slugs", () => {
  expect(Vow.safeParse({ id: "BAD ID", intent: "abc", slug: "ok" }).success).toBe(false);
  expect(Vow.safeParse({ id: "vow_ok", intent: "abc", slug: "Bad Slug" }).success).toBe(false);
});

test("a reference field requires a ref — the empty/absent shape is rejected at the boundary", () => {
  const missing = Field.safeParse({ name: "owner", type: "reference" });
  expect(missing.success).toBe(false);
  const blank = Field.safeParse({ name: "owner", ref: "", type: "reference" });
  expect(blank.success).toBe(false);
  // The error names the fix (a reference needs a ref) — not the downstream "references the empty string".
  const issue = missing.error?.issues[0];
  expect(issue?.message).toContain("ref");
  expect(issue?.path).toEqual(["ref"]);
  const valid = Field.safeParse({ name: "owner", ref: "user", type: "reference" });
  expect(valid.success).toBe(true);
});

test("a select field requires a non-empty options list", () => {
  expect(Field.safeParse({ name: "status", type: "select" }).success).toBe(false);
  expect(Field.safeParse({ name: "status", options: [], type: "select" }).success).toBe(false);
  expect(Field.safeParse({ name: "status", options: ["open"], type: "select" }).success).toBe(true);
});

test("non-reference, non-select fields need neither ref nor options", () => {
  expect(Field.safeParse({ name: "title", type: "text" }).success).toBe(true);
  expect(Field.safeParse({ name: "count", type: "number" }).success).toBe(true);
});
