import { expect, test } from "vite-plus/test";
import { Vow } from "../src/index.ts";

const leaf = {
  id: "vow_core",
  slug: "vow-model",
  intent: "The vow model as one recursive primitive",
  fulfills: { kind: "bind", module: "@vow/core", export: "Vow" },
  proof: [{ claim: "a vow validates recursively" }],
};

test("a vow validates, recursively (children are vows)", () => {
  const root = {
    id: "vow_root",
    slug: "vow",
    intent: "Build apps from specs, drift-free",
    children: [leaf],
  };
  const parsed = Vow.parse(root);
  expect(parsed.children[0]?.slug).toBe("vow-model");
  expect(parsed.children).toHaveLength(1);
});

test("fulfilment is emit OR bind — and nothing else", () => {
  const emit = Vow.safeParse({
    id: "vow_v",
    slug: "kanban",
    intent: "A kanban view",
    fulfills: { kind: "emit", as: "vue" },
  });
  expect(emit.success).toBe(true);
  const bind = Vow.safeParse({
    id: "vow_b",
    slug: "rollup",
    intent: "Status roll-up",
    fulfills: { kind: "bind", module: "@vow/core", export: "rollup" },
  });
  expect(bind.success).toBe(true);
  const bogus = Vow.safeParse({
    id: "vow_x",
    slug: "x",
    intent: "bogus fulfilment",
    fulfills: { kind: "magic" },
  });
  expect(bogus.success).toBe(false);
});

test("a vow stores NO status (status is derived, never stored)", () => {
  const parsed = Vow.parse({ id: "vow_s", slug: "no-status", intent: "status is derived" });
  expect("status" in parsed).toBe(false);
});

test("a pure-composition vow needs no fulfilment", () => {
  const grouping = Vow.safeParse({
    id: "vow_g",
    slug: "epic",
    intent: "A grouping epic",
    children: [leaf],
  });
  expect(grouping.success).toBe(true);
});

test("references use immutable ids, labels are kebab-case slugs", () => {
  expect(Vow.safeParse({ id: "BAD ID", slug: "ok", intent: "abc" }).success).toBe(false);
  expect(Vow.safeParse({ id: "vow_ok", slug: "Bad Slug", intent: "abc" }).success).toBe(false);
});
