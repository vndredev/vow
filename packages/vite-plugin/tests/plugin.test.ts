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
const tree: VowNode = {
  id: "vow_demo",
  slug: "demo-app",
  intent: "A demo vow tree",
  children: [card],
  proof: [],
};

test("the tree virtual id resolves; foreign ids are ignored", () => {
  expect(resolveVowId(VIRTUAL_TREE)).toBe(NUL + VIRTUAL_TREE);
  expect(resolveVowId("some/other/module")).toBeUndefined();
});

test("loading the tree id yields the vow tree as a live module — no file", () => {
  const code = loadVowModule(NUL + VIRTUAL_TREE, tree);
  expect(code).toContain("export const tree");
  expect(code).toContain("demo-app");
});

test("a component virtual id loads a runnable Vue component from the emit vow (plan → app, live)", () => {
  const id = "virtual:vow/component/welcome-card.vue";
  expect(resolveVowId(id)).toBe(NUL + id);
  const mod = loadVowModule(NUL + id, tree);
  expect(mod).toContain("defineComponent");
  expect(mod).toContain("Welcome to vow"); // the vow's intent, rendered as a component
});

test("findVow locates a vow by slug, depth-first", () => {
  expect(findVow(tree, "welcome-card")?.id).toBe("vow_card");
  expect(findVow(tree, "nope")).toBeUndefined();
});

test("the plugin is named `vow`, and the tree round-trips as self-contained JS", () => {
  expect(vow({ tree }).name).toBe("vow");
  expect(vowTreeModule(tree)).toContain('"id":"vow_demo"');
});
