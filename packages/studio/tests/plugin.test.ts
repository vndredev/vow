import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { discover } from "../src/discover.ts";
import { compileMarkdownModule } from "../src/plugin.ts";
import { loadVirtual, resolveVirtual, VIRTUAL } from "../src/virtual.ts";

const CONTENT = join(import.meta.dirname, "fixtures/content");

test("discover walks the content tree → routes + page metadata", () => {
  const { routes, pages } = discover(CONTENT);
  expect(routes.map((r) => r.path)).toEqual([
    "/",
    "/guide/",
    "/guide/emit",
    "/guide/primitives",
    "/guide/primitives/checkbox",
  ]);
  const emit = pages.find((p) => p.path === "/guide/emit");
  expect(emit?.title).toBe("emit"); // falls back to the H1 when no frontmatter title
  expect(emit?.group).toBe("Fulfilment");
  expect(emit?.order).toBe(0);
});

test("resolveVirtual only owns the virtual:vow-studio/* ids", () => {
  expect(resolveVirtual(VIRTUAL.routes)).toBe(`\0${VIRTUAL.routes}`);
  expect(resolveVirtual("some/other/id")).toBeUndefined();
});

test("loadVirtual serializes routes (with imports), sidebar and config", () => {
  const data = {
    routes: [{ path: "/guide/emit", file: "guide/emit.md" }],
    sidebar: [{ text: "UI", items: [{ text: "Primitives", link: "/guide/primitives" }] }],
    config: { title: "vow" },
    contentDir: "/abs",
  };
  const routesMod = loadVirtual(`\0${VIRTUAL.routes}`, data);
  expect(routesMod).toContain('path: "/guide/emit"');
  expect(routesMod).toContain('import("/abs/guide/emit.md")');
  expect(loadVirtual(`\0${VIRTUAL.sidebar}`, data)).toContain('"Primitives"');
  expect(loadVirtual(`\0${VIRTUAL.config}`, data)).toContain('"vow"');
});

test("compileMarkdownModule turns markdown into a Vue SFC", async () => {
  const sfc = await compileMarkdownModule("# Hi\n\ntext\n", join(CONTENT, "page.md"));
  expect(sfc).toContain("<template>");
  expect(sfc).toContain("<h1>Hi</h1>");
});
