import { expect, test } from "vite-plus/test";
import { matchRoute } from "../src/index.ts";

/** Derived from `matchRoute`'s own signature so the test keeps a single value import from the source
 *  under test (a separate type import from the same module is forbidden by the import rules). */
type Route = Parameters<typeof matchRoute>[0][number];

const stub: Route["load"] = async () => {
  await Promise.resolve();
  return { default: {} };
};
const routes: readonly Route[] = [
  { load: stub, path: "/" },
  { load: stub, path: "/guide/emit" },
  { load: stub, path: "/404" },
];

test("matchRoute matches exactly, else falls back to /404", () => {
  expect(matchRoute(routes, "/guide/emit")?.path).toBe("/guide/emit");
  expect(matchRoute(routes, "/missing")?.path).toBe("/404");
});

test("matchRoute returns absent with no match and no /404", () => {
  expect(matchRoute([{ load: stub, path: "/" }], "/x")).toBeUndefined();
});

test("matchRoute ignores a trailing slash (but keeps root)", () => {
  expect(matchRoute(routes, "/guide/emit/")?.path).toBe("/guide/emit");
  expect(matchRoute(routes, "/")?.path).toBe("/");
});
