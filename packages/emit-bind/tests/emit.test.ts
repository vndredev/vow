import { expect, test } from "vite-plus/test";
import type { Vow as VowNode } from "@vow/core";
import { emitBindAnchor } from "../src/index.ts";

const bind: VowNode = {
  children: [],
  fields: [],
  fulfills: { export: "computeTotal", kind: "bind", module: "./logic/invoice-total.ts" },
  id: "vow_total",
  intent: "Invoice total with a discount",
  proof: [{ claim: "a discount applies from 10 units" }],
  slug: "invoice-total",
};

test("emitBindAnchor re-exports the bound symbol so tsgo verifies it exists", () => {
  const code = emitBindAnchor(bind, "../app/logic/invoice-total.ts");
  expect(code).toContain('export { computeTotal } from "../app/logic/invoice-total.ts";');
});

test("emitBindAnchor fails fast on a non-bind vow", () => {
  const emit: VowNode = { ...bind, fulfills: { as: "view", kind: "emit" } };
  expect(() => emitBindAnchor(emit, "x")).toThrow();
});
