import { expect, test } from "vite-plus/test";
import { matchRoute, type Route } from "../src/index.ts";

const stub: Route["load"] = async () => ({ default: {} });
const routes: Route[] = [
  { path: "/", load: stub },
  { path: "/guide/emit", load: stub },
  { path: "/404", load: stub },
];

test("matchRoute matches exactly, else falls back to /404", () => {
  expect(matchRoute(routes, "/guide/emit")?.path).toBe("/guide/emit");
  expect(matchRoute(routes, "/missing")?.path).toBe("/404");
});

test("matchRoute returns null with no match and no /404", () => {
  expect(matchRoute([{ path: "/", load: stub }], "/x")).toBeNull();
});

test("matchRoute ignores a trailing slash (but keeps root)", () => {
  expect(matchRoute(routes, "/guide/emit/")?.path).toBe("/guide/emit");
  expect(matchRoute(routes, "/")?.path).toBe("/");
});
