import { expect, test } from "vite-plus/test";
import { VOW_ENV_DTS, emitBoot } from "../src/index.ts";

test("emitBoot mounts the root view (PascalCase) and imports the default theme", () => {
  const boot = emitBoot("landing");
  expect(boot).toContain('import { createApp } from "vue";');
  expect(boot).toContain('import "@vow/theme/vow.css";');
  expect(boot).toContain('import Landing from "./landing.vue";');
  expect(boot).toContain('createApp(Landing).mount("#app");');
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
