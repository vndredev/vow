import { expect, test } from "vite-plus/test";
import { type Vow } from "@vow/core";
import { emitTreeView } from "../src/index.ts";

/** A layout-only view (no `of:` entity) — the shape an app shell takes. */
const shell: Vow = {
  id: "vow_shell",
  slug: "app-shell",
  intent: "The app shell",
  children: [],
  fields: [],
  proof: [],
  fulfills: { kind: "emit", as: "view" },
  tree: {
    component: "Container",
    props: { size: "3" },
    children: [
      {
        component: "Flex",
        props: { direction: "column", gap: "4" },
        children: [{ component: "slot", props: {}, children: [] }],
      },
    ],
  },
};

test("emitTreeView renders the tree as nested layout components with a slot", () => {
  const sfc = emitTreeView(shell);
  expect(sfc).toContain('<Container :size="3">');
  expect(sfc).toContain('<Flex :direction="\'column\'" :gap="4">');
  expect(sfc).toContain("      <slot />");
});

test("a numeric prop is a number, a word prop is a string literal", () => {
  const sfc = emitTreeView(shell);
  expect(sfc).toContain(':gap="4"'); // number
  expect(sfc).toContain(":direction=\"'column'\""); // string literal
});

test("emitTreeView imports each referenced primitive from its generated .vue", () => {
  const sfc = emitTreeView(shell);
  expect(sfc).toContain('import Container from "./Container.vue";');
  expect(sfc).toContain('import Flex from "./Flex.vue";');
});

test("a named slot renders as <slot name=… />", () => {
  const withNamed: Vow = {
    ...shell,
    tree: {
      component: "Box",
      props: {},
      children: [{ component: "slot", props: { name: "header" }, children: [] }],
    },
  };
  expect(emitTreeView(withNamed)).toContain('<slot name="header" />');
});

test("emitTreeView rejects an unknown tree component", () => {
  const bad: Vow = { ...shell, tree: { component: "Flx", props: {}, children: [] } };
  expect(() => emitTreeView(bad)).toThrow(/unknown tree component/);
});
