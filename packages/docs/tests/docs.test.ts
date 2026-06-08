import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { buildLlms, buildSidebar, docSlug, generateDocs, routePath } from "../src/index.ts";

test("buildSidebar groups pages by `group`, ordered by the groups list then by `order`", () => {
  const sidebar = buildSidebar(
    [
      { path: "/b", file: "b.vue", group: "UI", order: 1, title: "B" },
      { path: "/a", file: "a.vue", group: "Intro", order: 0, title: "A" },
      { path: "/c", file: "c.vue", group: "UI", order: 0, title: "C" },
      { path: "/home", file: "home.vue", order: 0, title: "Home" }, // ungrouped → excluded
    ],
    ["Intro", "UI"],
  );
  expect(sidebar.map((g) => g.title)).toEqual(["Intro", "UI"]);
  expect(sidebar[1]?.items.map((i) => i.title)).toEqual(["C", "B"]); // order 0 before 1
});

test("docSlug derives a unique, path-based doc- slug", () => {
  expect(docSlug("/c", "/c/guide/emit.md")).toBe("doc-guide-emit");
  expect(docSlug("/c", "/c/index.md")).toBe("doc-index");
});

test("routePath gives a clean URL, collapsing index to its folder", () => {
  expect(routePath("guide/emit")).toBe("/guide/emit");
  expect(routePath("index")).toBe("/");
  expect(routePath("guide/index")).toBe("/guide");
});

test("buildSidebar nests pages under a parent path (subpages under their section)", () => {
  const sidebar = buildSidebar(
    [
      { path: "/guide/primitives", file: "p.vue", group: "UI", order: 1, title: "Primitives" },
      {
        path: "/guide/primitives/checkbox",
        file: "c.vue",
        group: "UI",
        order: 1.1,
        title: "Checkbox",
      },
    ],
    ["UI"],
  );
  const primitives = sidebar[0]?.items[0];
  expect(primitives?.title).toBe("Primitives");
  expect(primitives?.items?.map((i) => i.title)).toEqual(["Checkbox"]);
});

test("buildSidebar nests at any depth, regardless of input order", () => {
  const sidebar = buildSidebar(
    [
      { path: "/g/a/b/c", file: "c.vue", group: "UI", order: 3, title: "C" },
      { path: "/g/a", file: "a.vue", group: "UI", order: 1, title: "A" },
      { path: "/g/a/b", file: "b.vue", group: "UI", order: 2, title: "B" },
    ],
    ["UI"],
  );
  const a = sidebar[0]?.items[0];
  expect(a?.title).toBe("A");
  const b = a?.items?.[0];
  expect(b?.title).toBe("B");
  expect(b?.items?.[0]?.title).toBe("C");
});

test("generateDocs renders each .md into a prose .vue + a routes manifest", () => {
  const content = mkdtempSync(join(tmpdir(), "vow-docs-content-"));
  writeFileSync(
    join(content, "intro.md"),
    "---\ngroup: Intro\n---\n\n# Intro\n\nHello **world**.\n",
  );
  const out = mkdtempSync(join(tmpdir(), "vow-docs-out-"));

  const written = generateDocs(content, out); // no highlighter → plain code blocks
  expect(written).toHaveLength(3); // the page + the routes manifest + the layout

  const vue = readFileSync(join(out, "doc-intro.vue"), "utf8");
  expect(vue).toContain('<div class="vow-doc">');
  expect(vue).toContain("<h1>Intro</h1>");
  expect(vue).toContain("<strong>world</strong>");
  expect(vue).not.toContain("group: Intro"); // frontmatter stripped

  const manifest = readFileSync(join(out, "vow-docs.routes.ts"), "utf8");
  expect(manifest).toContain('path: "/intro"');
  expect(manifest).toContain('import("./doc-intro.vue")');
  expect(manifest).toContain('title: "Intro · Docs"'); // "<page> · <site>"
  expect(manifest).toContain("export const sidebar: SidebarGroup[]");
  expect(manifest).toContain('"title": "Intro"'); // group from frontmatter, in the sidebar
});

test("buildLlms builds an llms.txt index + a full single-file dump", () => {
  const { index, full } = buildLlms(
    [
      {
        title: "Intro",
        path: "/guide",
        group: "Introduction",
        order: 0,
        body: "Welcome to vow. It generates apps.\n",
      },
      {
        title: "Primitives",
        path: "/guide/primitives",
        group: "UI",
        order: 3,
        body: "# Primitives\n\nControls.\n",
      },
      {
        title: "Button",
        path: "/guide/primitives/button",
        group: "UI",
        order: 3.0,
        body: "# Button\n\nA control.\n\n::: demo button\n:::\n",
      },
    ],
    { title: "vow", description: "LLM-first." },
    ["Introduction", "UI"],
  );

  // the index: header + summary + grouped links, each with a one-line description
  expect(index).toContain("# vow");
  expect(index).toContain("> LLM-first.");
  expect(index).toContain("## Introduction");
  expect(index).toContain("- [Intro](/guide): Welcome to vow.");
  // a parent page precedes its children on an order tie (path tiebreak): Primitives before Button
  expect(index.indexOf("(/guide/primitives)")).toBeLessThan(
    index.indexOf("(/guide/primitives/button)"),
  );

  // the full dump: every body inlined, live `::: demo` placeholders stripped
  expect(full).toContain("# vow — full documentation");
  expect(full).toContain("> Source: /guide/primitives");
  expect(full).toContain("# Button");
  expect(full).not.toContain("::: demo");
});
