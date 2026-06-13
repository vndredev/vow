import { LAYOUT_SUFFIX, ROUTES_EXPORT, ROUTES_SUFFIX } from "@vow/emit-view";
import { buildLlms, buildSidebar, docSlug, generateDocs, routePath } from "../src/index.ts";
import { expect, test } from "vite-plus/test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { cacheFresh } from "../src/scan.ts";
import path from "node:path";
import { tmpdir } from "node:os";

// The page + the routes manifest + the layout — the files a single-page scan writes.
const SINGLE_PAGE_FILES = 3;

test("buildSidebar groups pages by `group`, ordered by the groups list then by `order`", () => {
  const sidebar = buildSidebar(
    [
      { file: "b.vue", group: "UI", order: 1, path: "/b", title: "B" },
      { file: "a.vue", group: "Intro", order: 0, path: "/a", title: "A" },
      { file: "c.vue", group: "UI", order: 0, path: "/c", title: "C" },
      // Ungrouped -> excluded
      { file: "home.vue", order: 0, path: "/home", title: "Home" },
    ],
    ["Intro", "UI"],
  );
  expect(sidebar.map((group) => group.title)).toEqual(["Intro", "UI"]);
  // Order 0 before 1
  expect(sidebar[1]?.items.map((item) => item.title)).toEqual(["C", "B"]);
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
      { file: "p.vue", group: "UI", order: 1, path: "/guide/primitives", title: "Primitives" },
      {
        file: "c.vue",
        group: "UI",
        order: 1.1,
        path: "/guide/primitives/checkbox",
        title: "Checkbox",
      },
    ],
    ["UI"],
  );
  const primitives = sidebar[0]?.items[0];
  expect(primitives?.title).toBe("Primitives");
  expect(primitives?.items?.map((item) => item.title)).toEqual(["Checkbox"]);
});

test("buildSidebar nests at any depth, regardless of input order", () => {
  const deepest = 3;
  const middle = 2;
  const sidebar = buildSidebar(
    [
      { file: "c.vue", group: "UI", order: deepest, path: "/g/a/b/c", title: "C" },
      { file: "a.vue", group: "UI", order: 1, path: "/g/a", title: "A" },
      { file: "b.vue", group: "UI", order: middle, path: "/g/a/b", title: "B" },
    ],
    ["UI"],
  );
  const first = sidebar[0]?.items[0];
  expect(first?.title).toBe("A");
  const second = first?.items?.[0];
  expect(second?.title).toBe("B");
  expect(second?.items?.[0]?.title).toBe("C");
});

/** Write a single `intro.md` into a fresh content dir, generate into a fresh out dir, return both. */
function generateIntro(): { out: string; written: readonly string[] } {
  const content = mkdtempSync(path.join(tmpdir(), "vow-docs-content-"));
  writeFileSync(
    path.join(content, "intro.md"),
    "---\ngroup: Intro\n---\n\n# Intro\n\nHello **world**.\n",
  );
  const out = mkdtempSync(path.join(tmpdir(), "vow-docs-out-"));
  // No highlighter -> plain code blocks
  return { out, written: generateDocs(content, out) };
}

/** Assert the generated prose `.vue` renders the markdown and strips the frontmatter. */
function expectProse(out: string): void {
  const vue = readFileSync(path.join(out, "doc-intro.vue"), "utf8");
  expect(vue).toContain('<div class="vow-doc" data-vow-source="doc-intro">');
  expect(vue).toContain("<h1>Intro</h1>");
  expect(vue).toContain("<strong>world</strong>");
  // Frontmatter stripped
  expect(vue).not.toContain("group: Intro");
}

/** Assert the generated routes manifest carries the route, the import, the title, and the sidebar. */
function expectManifest(out: string): void {
  const manifest = readFileSync(path.join(out, "vow-docs.routes.ts"), "utf8");
  expect(manifest).toContain('path: "/intro"');
  expect(manifest).toContain('import("./doc-intro.vue")');
  // "<page> · <site>"
  expect(manifest).toContain('title: "Intro · Docs"');
  expect(manifest).toContain("export const sidebar: SidebarGroup[]");
  // Group from frontmatter, in the sidebar
  expect(manifest).toContain('"title": "Intro"');
}

test("generateDocs renders each .md into a prose .vue + a routes manifest", () => {
  const { out, written } = generateIntro();
  expect(written).toHaveLength(SINGLE_PAGE_FILES);
  expectProse(out);
  expectManifest(out);
});

test("the docs chrome honors the boot glob convention — shared suffixes + routes export", () => {
  const { out, written } = generateIntro();
  // The boot globs `*.routes.ts` / `*.layout.vue`; both producer files must end with the shared suffix.
  const routesFile = written.find((file) => file.endsWith(ROUTES_SUFFIX));
  const layoutFile = written.find((file) => file.endsWith(LAYOUT_SUFFIX));
  expect(routesFile).toBeDefined();
  expect(layoutFile).toBeDefined();
  // The routes manifest must export the shared key the boot reads each fragment by.
  const manifest = readFileSync(path.join(out, "vow-docs.routes.ts"), "utf8");
  expect(manifest).toContain(`export const ${ROUTES_EXPORT}: Route[] =`);
});

test("buildLlms builds an llms.txt index + a full single-file dump", () => {
  const { full, index } = buildLlms(
    [
      {
        body: "Welcome to vow. It generates apps.\n",
        group: "Introduction",
        order: 0,
        path: "/guide",
        title: "Intro",
      },
      {
        body: "# Primitives\n\nControls.\n",
        group: "UI",
        order: 3,
        path: "/guide/primitives",
        title: "Primitives",
      },
      {
        body: "# Button\n\nA control.\n\n::: demo button\n:::\n",
        group: "UI",
        order: 3,
        path: "/guide/primitives/button",
        title: "Button",
      },
    ],
    { description: "LLM-first.", title: "vow" },
    ["Introduction", "UI"],
  );

  // The index: header + summary + grouped links, each with a one-line description
  expect(index).toContain("# vow");
  expect(index).toContain("> LLM-first.");
  expect(index).toContain("## Introduction");
  expect(index).toContain("- [Intro](/guide): Welcome to vow.");
  // A parent page precedes its children on an order tie (path tiebreak): Primitives before Button
  expect(index.indexOf("(/guide/primitives)")).toBeLessThan(
    index.indexOf("(/guide/primitives/button)"),
  );

  // The full dump: every body inlined, live `::: demo` placeholders stripped
  expect(full).toContain("# vow — full documentation");
  expect(full).toContain("> Source: /guide/primitives");
  expect(full).toContain("# Button");
  expect(full).not.toContain("::: demo");
});

/** The order of the route `path:` lines emitted in the manifest — the scanned page order. */
function manifestRouteOrder(manifest: string): string[] {
  return [...manifest.matchAll(/path: "([^"]+)", title: .* load: \(\) => import/gu)].map(
    (match: readonly string[]) => match[1] ?? "",
  );
}

/** The order of the search index's top-level page paths (its `path` entries without a `#` anchor). */
function searchPageOrder(manifest: string): string[] {
  const block = /export const search: SearchItem\[\] = (\[[\s\S]*?\]);/u.exec(manifest)?.[1] ?? "";
  return [...block.matchAll(/"path": "([^"#]+)"/gu)].map(
    (match: readonly string[]) => match[1] ?? "",
  );
}

/** Write each `name` (relative to `content`, `/`-joined) as a stub `.md`, creating parent dirs. */
function writeStubs(content: string, names: readonly string[]): void {
  for (const name of names) {
    const full = path.join(content, name);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, `# ${name}\n\nBody.\n`);
  }
}

test("the routes + search manifest is sorted, independent of filesystem readdir order", () => {
  // Names whose insertion order differs from sorted, plus a nested folder — pins multi-file order
  // (the single-page scan above can't catch a readdir-order regression).
  const content = mkdtempSync(path.join(tmpdir(), "vow-docs-order-"));
  writeStubs(content, ["c.md", "a.md", "b.md", "sub/z.md", "sub/m.md"]);
  const out = mkdtempSync(path.join(tmpdir(), "vow-docs-order-out-"));
  generateDocs(content, out);
  const manifest = readFileSync(path.join(out, "vow-docs.routes.ts"), "utf8");

  const sortedRoutes = ["/a", "/b", "/c", "/sub/m", "/sub/z"];
  expect(manifestRouteOrder(manifest)).toEqual(sortedRoutes);
  expect(searchPageOrder(manifest)).toEqual(sortedRoutes);
});

test("cacheFresh hits only when the mtime is unchanged — so an edited .md (new mtime) re-scans", () => {
  const MTIME = 1700;
  expect(cacheFresh(MTIME, MTIME)).toBe(true);
  expect(cacheFresh(MTIME, MTIME + 1)).toBe(false);
});
