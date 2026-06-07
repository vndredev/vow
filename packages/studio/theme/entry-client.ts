import { createSSRApp, h } from "vue";
import { config } from "virtual:vow-studio/config";
import { routes } from "virtual:vow-studio/routes";
import { sidebar } from "virtual:vow-studio/sidebar";
import App from "./App.vue";
import Callout from "./Callout.vue";
import { createStudioRouter } from "./router.ts";
import "@vow/theme/vow.css";
import "./studio.css";

// Hydrate the server-rendered HTML, then take over in-app navigation (SPA-after-hydration).
const router = createStudioRouter(routes, location.pathname);
void router.load(location.pathname);

const app = createSSRApp({ render: () => h(App, { router, sidebar, config }) });
app.component("Callout", Callout);
app.mount("#app");

// Intercept internal links so navigation doesn't full-reload.
document.addEventListener("click", (event) => {
  const anchor = (event.target as HTMLElement | null)?.closest?.("a");
  const href = anchor?.getAttribute("href");
  if (!anchor || !href || !href.startsWith("/") || anchor.target === "_blank") return;
  event.preventDefault();
  void router.go(href);
  window.scrollTo(0, 0);
});
window.addEventListener("popstate", () => void router.go(location.pathname));
