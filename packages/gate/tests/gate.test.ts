import { expect, test } from "vite-plus/test";
import { expectedScenarios, testNamesIn } from "../src/index.ts";
import type { Vow as VowNode } from "@vow/core";

test("expectedScenarios derives for emit entity, reads ## proves otherwise", () => {
  const entity: VowNode = {
    children: [],
    fields: [{ name: "title", required: true, type: "text" }],
    fulfills: { as: "entity", kind: "emit" },
    id: "vow_e",
    intent: "x",
    proof: [],
    slug: "task",
  };
  expect(expectedScenarios(entity)).toContain("Task without 'title' is rejected");

  const bind: VowNode = {
    children: [],
    fields: [],
    fulfills: { export: "f", kind: "bind", module: "./x.ts" },
    id: "vow_b",
    intent: "x",
    proof: [{ claim: "a discount applies from 10 units" }],
    slug: "total",
  };
  expect(expectedScenarios(bind)).toEqual(["a discount applies from 10 units"]);
});

test("testNamesIn extracts both test() and it() names", () => {
  const src = `test("alpha", () => {});\nit('beta', () => {});`;
  expect(testNamesIn(src)).toEqual(["alpha", "beta"]);
});
