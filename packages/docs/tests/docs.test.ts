import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { docSlug, generateDocs, routePath } from "../src/index.ts";

test("docSlug derives a unique, path-based doc- slug", () => {
  expect(docSlug("/c", "/c/guide/emit.md")).toBe("doc-guide-emit");
  expect(docSlug("/c", "/c/index.md")).toBe("doc-index");
});

test("routePath gives a clean URL, collapsing index to its folder", () => {
  expect(routePath("guide/emit")).toBe("/guide/emit");
  expect(routePath("index")).toBe("/");
  expect(routePath("guide/index")).toBe("/guide");
});

test("generateDocs renders each .md into a prose .vue + a routes manifest", () => {
  const content = mkdtempSync(join(tmpdir(), "vow-docs-content-"));
  writeFileSync(
    join(content, "intro.md"),
    "---\ngroup: Intro\n---\n\n# Intro\n\nHello **world**.\n",
  );
  const out = mkdtempSync(join(tmpdir(), "vow-docs-out-"));

  const written = generateDocs(content, out); // no highlighter → plain code blocks
  expect(written).toHaveLength(2); // the page + the manifest

  const vue = readFileSync(join(out, "doc-intro.vue"), "utf8");
  expect(vue).toContain('<div class="vow-doc">');
  expect(vue).toContain("<h1>Intro</h1>");
  expect(vue).toContain("<strong>world</strong>");
  expect(vue).not.toContain("group: Intro"); // frontmatter stripped

  const manifest = readFileSync(join(out, "vow-docs-routes.ts"), "utf8");
  expect(manifest).toContain('{ path: "/intro", load: () => import("./doc-intro.vue") }');
});
