import { expect, test } from "vite-plus/test";
import { matchRoute, type RouteDef } from "../theme/router.ts";

const stub: RouteDef["component"] = async () => ({ default: {} });
const routes: RouteDef[] = [
  { path: "/", component: stub },
  { path: "/guide/emit", component: stub },
  { path: "/404", component: stub },
];

test("matchRoute matches exactly, else falls back to /404", () => {
  expect(matchRoute(routes, "/guide/emit")?.path).toBe("/guide/emit");
  expect(matchRoute(routes, "/missing")?.path).toBe("/404");
});

test("matchRoute returns null with no match and no 404", () => {
  expect(matchRoute([{ path: "/", component: stub }], "/x")).toBeNull();
});
