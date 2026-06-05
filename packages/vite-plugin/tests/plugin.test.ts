import { expect, test } from "vite-plus/test";
import { type Vow as VowNode } from "@vow/core";
import {
  findVow,
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
  proof: [],
  fulfills: { kind: "emit", as: "vue" },
};
const forest: VowNode[] = [card];

test("the tree virtual id resolves; foreign ids are ignored", () => {
  expect(resolveVowId(VIRTUAL_TREE)).toBe(NUL + VIRTUAL_TREE);
  expect(resolveVowId("some/other/module")).toBeUndefined();
});

test("loading the tree id yields the vow forest as a live module — no file", () => {
  const code = loadVowModule(NUL + VIRTUAL_TREE, forest);
  expect(code).toContain("export const tree");
  expect(code).toContain("welcome-card");
});

test("a component virtual id loads a runnable Vue component from the emit vow (plan → app, live)", () => {
  const id = "virtual:vow/component/welcome-card.vue";
  expect(resolveVowId(id)).toBe(NUL + id);
  const mod = loadVowModule(NUL + id, forest);
  expect(mod).toContain("defineComponent");
  expect(mod).toContain("Welcome to vow");
});

test("findVow locates a vow by slug across the forest, depth-first", () => {
  const nested: VowNode = {
    id: "vow_root",
    slug: "app",
    intent: "Root",
    children: [card],
    proof: [],
  };
  expect(findVow([nested], "welcome-card")?.id).toBe("vow_card");
  expect(findVow([nested], "nope")).toBeUndefined();
});

test("the plugin is named `vow`, and the forest round-trips as self-contained JS", () => {
  expect(vow({ vows: forest }).name).toBe("vow");
  expect(vowTreeModule(forest)).toContain('"id":"vow_card"');
});
