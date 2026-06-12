import {
  LAYOUT_SUFFIX,
  ROUTES_EXPORT,
  ROUTES_SUFFIX,
  VOW_ENV_DTS,
  emitAppRoutes,
  emitBoot,
} from "../src/index.ts";
import { expect, test } from "vite-plus/test";

test("emitBoot generates a router boot — root route + the theme, mounted on #app", () => {
  const boot = emitBoot("landing");
  expect(boot).toContain('import { createRouter, type Route } from "@vow/router";');
  expect(boot).toContain('import "@vow/theme/vow.css";');
  expect(boot).toContain('import Landing from "./landing.vue";');
  expect(boot).toContain('{ path: "/", load: async () => ({ default: Landing }) }');
  expect(boot).toContain('createRouter(routes, { layout }).mount("#app");');
});

test("the router boot folds in optional routes + chrome via the *.routes / *.layout convention", () => {
  const boot = emitBoot("home");
  expect(boot).toContain('import.meta.glob<{ routes?: Route[] }>("./*.routes.ts"');
  expect(boot).toContain("m.routes ?? []");
  expect(boot).toContain('import.meta.glob<{ default: Component }>("./*.layout.vue"');
});

test("the boot reads the same glob convention the producers write — one shared source", () => {
  const boot = emitBoot("home");
  // The boot globs by the shared suffix and reads each fragment by the shared export name.
  expect(boot).toContain(`"./*${ROUTES_SUFFIX}"`);
  expect(boot).toContain(`"./*${LAYOUT_SUFFIX}"`);
  expect(boot).toContain(`m.${ROUTES_EXPORT} ?? []`);
  // The app's own routes producer exports that same shared key.
  expect(emitAppRoutes([{ slug: "about", title: "About" }])).toContain(
    `export const ${ROUTES_EXPORT}: Route[] =`,
  );
});

test("emitBoot can omit the theme", () => {
  const boot = emitBoot("home", false);
  expect(boot).not.toContain(".css");
  expect(boot).toContain('import Home from "./home.vue";');
});

test("the boot no longer seeds — records load from the DB through the store, not at boot", () => {
  const boot = emitBoot("home");
  expect(boot).not.toContain("@vow/store");
  expect(boot).not.toContain("seed");
});

test("the env shims declare the *.vue and *.css modules tsgo needs", () => {
  expect(VOW_ENV_DTS).toContain('declare module "*.vue"');
  expect(VOW_ENV_DTS).toContain('declare module "*.css"');
});
