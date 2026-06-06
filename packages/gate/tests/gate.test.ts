import { expect, test } from "vite-plus/test";
import { type Vow as VowNode } from "@vow/core";
import { expectedScenarios, testNamesIn } from "../src/index.ts";

test("expectedScenarios derives for emit entity, reads ## proves otherwise", () => {
  const entity: VowNode = {
    id: "vow_e",
    slug: "task",
    intent: "x",
    children: [],
    fields: [{ name: "title", type: "text", required: true }],
    proof: [],
    fulfills: { kind: "emit", as: "entity" },
  };
  expect(expectedScenarios(entity)).toContain("Task without 'title' is rejected");

  const bind: VowNode = {
    id: "vow_b",
    slug: "total",
    intent: "x",
    children: [],
    fields: [],
    proof: [{ claim: "ab 10 greift der Rabatt" }],
    fulfills: { kind: "bind", module: "./x.ts", export: "f" },
  };
  expect(expectedScenarios(bind)).toEqual(["ab 10 greift der Rabatt"]);
});

test("testNamesIn extracts both test() and it() names", () => {
  const src = `test("alpha", () => {});\nit('beta', () => {});`;
  expect(testNamesIn(src)).toEqual(["alpha", "beta"]);
});
