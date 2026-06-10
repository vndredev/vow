import { expect, test } from "vite-plus/test";
import { Vow } from "../src/index.ts";

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
