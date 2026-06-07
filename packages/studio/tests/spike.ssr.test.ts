import { expect, test } from "vite-plus/test";
import { renderToString } from "@vue/server-renderer";
import { createSSRApp, h } from "vue";
import App from "../spike/App.vue";

/**
 * P0 spike — prove the SSG render path works on Vite+: a `.vue` SFC compiles through @vitejs/plugin-vue
 * and server-renders to HTML via @vue/server-renderer (props + slot included). This is the half the SSG
 * build depends on; the full `vite build --ssr` bundling is validated in a later phase.
 */
test("a Vue SFC compiles + server-renders to HTML under Vite+", async () => {
  const app = createSSRApp({
    render: () => h(App, { title: "vow" }, { default: () => h("p", "rendered server-side") }),
  });

  const html = await renderToString(app);
  expect(html).toContain("<h1>vow</h1>");
  expect(html).toContain("rendered server-side");
  expect(html).toContain('class="vow-doc"');
});
