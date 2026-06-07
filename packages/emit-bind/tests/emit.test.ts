import { expect, test } from "vite-plus/test";
import { type Vow as VowNode } from "@vow/core";
import { emitBindAnchor } from "../src/index.ts";

const bind: VowNode = {
  id: "vow_total",
  slug: "invoice-total",
  intent: "Invoice total with a discount",
  children: [],
  fields: [],
  proof: [{ claim: "a discount applies from 10 units" }],
  fulfills: { kind: "bind", module: "./logic/invoice-total.ts", export: "computeTotal" },
};

test("emitBindAnchor re-exports the bound symbol so tsgo verifies it exists", () => {
  const code = emitBindAnchor(bind, "../app/logic/invoice-total.ts");
  expect(code).toContain('export { computeTotal } from "../app/logic/invoice-total.ts";');
});

test("emitBindAnchor fails fast on a non-bind vow", () => {
  const emit: VowNode = { ...bind, fulfills: { kind: "emit", as: "view" } };
  expect(() => emitBindAnchor(emit, "x")).toThrow();
});
