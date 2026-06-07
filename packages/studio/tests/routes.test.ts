import { expect, test } from "vite-plus/test";
import { routes, toRoutePath } from "../src/routes.ts";

test("toRoutePath derives clean URLs (index → folder, else drop .md)", () => {
  expect(toRoutePath("index.md")).toBe("/");
  expect(toRoutePath("guide/index.md")).toBe("/guide/");
  expect(toRoutePath("guide/emit.md")).toBe("/guide/emit");
  expect(toRoutePath("guide/primitives/checkbox.md")).toBe("/guide/primitives/checkbox");
});

test("routes keeps markdown only, maps to {path, file}, sorted by path", () => {
  const table = routes([
    "guide/emit.md",
    "index.md",
    "guide/index.md",
    "styles.css",
    "guide/primitives/checkbox.md",
  ]);
  expect(table.map((r) => r.path)).toEqual([
    "/",
    "/guide/",
    "/guide/emit",
    "/guide/primitives/checkbox",
  ]);
  expect(table.find((r) => r.path === "/guide/emit")?.file).toBe("guide/emit.md");
});
