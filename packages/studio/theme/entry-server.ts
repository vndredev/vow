import { renderToString } from "@vue/server-renderer";
import { createSSRApp, h } from "vue";
import { config } from "virtual:vow-studio/config";
import { routes } from "virtual:vow-studio/routes";
import { sidebar } from "virtual:vow-studio/sidebar";
import App from "./App.vue";
import Callout from "./Callout.vue";
import FrameworkBlock from "./FrameworkBlock.vue";
import Home from "./Home.vue";
import { createStudioRouter } from "./router.ts";

/** Render a route to HTML for the SSG build (one call per route). */
export async function render(url: string): Promise<string> {
  const router = createStudioRouter(routes, url);
  await router.load(url);
  const app = createSSRApp({ render: () => h(App, { router, sidebar, config }) });
  app.component("Callout", Callout);
  app.component("FrameworkBlock", FrameworkBlock);
  app.component("Home", Home);
  return renderToString(app);
}
