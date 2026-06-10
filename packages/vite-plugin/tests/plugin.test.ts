import {
  VIRTUAL_TREE,
  allVows,
  loadVowModule,
  resolveVowId,
  vow,
  vowTreeModule,
} from "../src/index.ts";
import { expect, test } from "vite-plus/test";
import type { Vow as VowNode } from "@vow/core";

const NUL = "\0";

const card: VowNode = {
  children: [],
  fields: [],
  fulfills: { as: "view", kind: "emit" },
  id: "vow_card",
  intent: "Welcome to vow",
  proof: [],
  slug: "welcome-card",
};
const root: VowNode = {
  children: [card],
  fields: [],
  id: "vow_root",
  intent: "Root",
  proof: [],
  slug: "app",
};
const vows: VowNode[] = [root];

test("the tree virtual id resolves; foreign ids are ignored", () => {
  expect(resolveVowId(VIRTUAL_TREE)).toBe(NUL + VIRTUAL_TREE);
  expect(resolveVowId("some/other/module")).toBeUndefined();
});

test("loading the tree id yields the vows as data — no file", () => {
  const code = loadVowModule(NUL + VIRTUAL_TREE, vows);
  expect(code).toContain("export const tree");
  expect(code).toContain("welcome-card");
});

test("allVows flattens the tree depth-first", () => {
  expect(allVows(vows).map((node) => node.slug)).toEqual(["app", "welcome-card"]);
});

test("the plugin is named `vow`, and the vows round-trip as self-contained JS", () => {
  expect(vow({ vows }).name).toBe("vow");
  expect(vowTreeModule(vows)).toContain('"id":"vow_card"');
});
