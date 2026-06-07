import { expect, test } from "vite-plus/test";
import { type Vow as VowNode } from "@vow/core";
import {
  allVows,
  loadVowModule,
  resolveVowId,
  VIRTUAL_TREE,
  vow,
  vowTreeModule,
} from "../src/index.ts";

const NUL = "\0";

const card: VowNode = {
  id: "vow_card",
  slug: "welcome-card",
  intent: "Welcome to vow",
  children: [],
  fields: [],
  proof: [],
  fulfills: { kind: "emit", as: "view" },
};
const root: VowNode = {
  id: "vow_root",
  slug: "app",
  intent: "Root",
  children: [card],
  fields: [],
  proof: [],
};
const forest: VowNode[] = [root];

test("the tree virtual id resolves; foreign ids are ignored", () => {
  expect(resolveVowId(VIRTUAL_TREE)).toBe(NUL + VIRTUAL_TREE);
  expect(resolveVowId("some/other/module")).toBeUndefined();
});

test("loading the tree id yields the vow forest as data — no file", () => {
  const code = loadVowModule(NUL + VIRTUAL_TREE, forest);
  expect(code).toContain("export const tree");
  expect(code).toContain("welcome-card");
});

test("allVows flattens the forest depth-first", () => {
  expect(allVows(forest).map((v) => v.slug)).toEqual(["app", "welcome-card"]);
});

test("the plugin is named `vow`, and the forest round-trips as self-contained JS", () => {
  expect(vow({ vows: forest }).name).toBe("vow");
  expect(vowTreeModule(forest)).toContain('"id":"vow_card"');
});
