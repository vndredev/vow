import { expect, test } from "vite-plus/test";
import { VOW_ENV_DTS, emitBoot } from "../src/index.ts";

test("emitBoot generates a router boot — root route + the theme, mounted on #app", () => {
  const boot = emitBoot("landing");
  expect(boot).toContain('import { createRouter, type Route } from "@vow/router";');
  expect(boot).toContain('import "@vow/theme/vow.css";');
  expect(boot).toContain('import Landing from "./landing.vue";');
  expect(boot).toContain('{ path: "/", load: async () => ({ default: Landing }) }');
  expect(boot).toContain('createRouter(routes, { layout }).mount("#app");');
});

test("the router boot folds in optional @vow/docs routes + chrome via import.meta.glob", () => {
  const boot = emitBoot("home");
  expect(boot).toContain('import.meta.glob<{ routes?: Route[] }>("./vow-docs-routes.ts"');
  expect(boot).toContain("m.routes ?? []");
  expect(boot).toContain('import.meta.glob<{ default: Component }>("./vow-docs-layout.vue"');
});

test("emitBoot can omit the theme", () => {
  const boot = emitBoot("home", false);
  expect(boot).not.toContain(".css");
  expect(boot).toContain('import Home from "./home.vue";');
});

test("the env shims declare the *.vue and *.css modules tsgo needs", () => {
  expect(VOW_ENV_DTS).toContain('declare module "*.vue"');
  expect(VOW_ENV_DTS).toContain('declare module "*.css"');
});
