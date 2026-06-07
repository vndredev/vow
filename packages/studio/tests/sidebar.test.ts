import { expect, test } from "vite-plus/test";
import { defineStudio } from "../src/config.ts";
import { buildSidebar, type Page } from "../src/sidebar.ts";

const PAGES: Page[] = [
  {
    file: "guide/index.md",
    path: "/guide/",
    title: "What is vow?",
    group: "Introduction",
    order: 0,
  },
  {
    file: "guide/getting-started.md",
    path: "/guide/getting-started",
    title: "Getting started",
    group: "Introduction",
    order: 1,
  },
  { file: "guide/emit.md", path: "/guide/emit", title: "emit", group: "Fulfilment", order: 0 },
  {
    file: "guide/primitives.md",
    path: "/guide/primitives",
    title: "Primitives",
    group: "UI",
    order: 1,
  },
  {
    file: "guide/primitives/checkbox.md",
    path: "/guide/primitives/checkbox",
    title: "Checkbox",
    group: "UI",
    order: 0,
  },
];

test("groups top-level pages in group order, sorted by order", () => {
  const sidebar = buildSidebar(PAGES, ["Introduction", "Fulfilment", "UI"]);
  expect(sidebar.map((g) => g.text)).toEqual(["Introduction", "Fulfilment", "UI"]);
  expect(sidebar[0]?.items.map((i) => i.text)).toEqual(["What is vow?", "Getting started"]);
});

test("nests a sub-page under its folder parent, not at the group's top level", () => {
  const sidebar = buildSidebar(PAGES, ["Introduction", "Fulfilment", "UI"]);
  const ui = sidebar.find((g) => g.text === "UI");
  expect(ui?.items.map((i) => i.text)).toEqual(["Primitives"]); // Checkbox is NOT top-level
  const primitives = ui?.items.find((i) => i.text === "Primitives");
  expect(primitives?.items?.map((i) => i.text)).toEqual(["Checkbox"]);
});

test("omits a group with no pages", () => {
  const sidebar = buildSidebar(PAGES, ["Introduction", "Nope", "UI"]);
  expect(sidebar.map((g) => g.text)).toEqual(["Introduction", "UI"]);
});

test("defineStudio is a typed identity", () => {
  const config = defineStudio({ title: "vow", nav: [{ text: "Guide", link: "/guide/" }] });
  expect(config.title).toBe("vow");
  expect(config.nav?.[0]?.link).toBe("/guide/");
});
