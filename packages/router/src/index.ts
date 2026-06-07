import { type Component, createApp, h, shallowRef } from "vue";

/**
 * @vow/router — a tiny client router for generated vow apps. One central server serves every route;
 * the boot builds a routes table (the root page + the `@vow/docs` pages) and mounts the page matching
 * `location.pathname`, intercepting internal links so navigation never full-reloads.
 */

/** A route: a path and a lazy loader for its page component (a `.vue` default export). */
export interface Route {
  readonly path: string;
  readonly load: () => Promise<{ default: Component }>;
}

/** The route for a path: an exact match, else the `/404` route, else null. */
export function matchRoute(routes: readonly Route[], path: string): Route | null {
  return routes.find((r) => r.path === path) ?? routes.find((r) => r.path === "/404") ?? null;
}

/** The built-in fallback shown when no route (and no `/404`) matches — a minimal "not found" page. */
const NotFound: Component = {
  render: () =>
    h("div", { class: "vow-doc" }, [
      h("h1", "404"),
      h("p", "This page could not be found."),
      h("p", [h("a", { href: "/" }, "Go home")]),
    ]),
};

export interface RouterOptions {
  /** A chrome component wrapping every page — it receives a `path` prop and the page in its slot. */
  readonly layout?: Component;
}

export interface Router {
  /** Resolve the initial route and mount the app, then take over in-app navigation. */
  mount(selector: string): Promise<void>;
}

/** Create a router over the given routes (browser-only — uses history + the DOM). */
export function createRouter(routes: readonly Route[], options: RouterOptions = {}): Router {
  const page = shallowRef<Component | null>(null);
  const path = shallowRef("/");

  const load = async (to: string): Promise<void> => {
    path.value = to;
    const route = matchRoute(routes, to);
    page.value = route ? (await route.load()).default : null;
  };

  return {
    async mount(selector) {
      await load(window.location.pathname);
      const outlet = () => h(page.value ?? NotFound);
      const render = (): ReturnType<typeof h> | null =>
        options.layout ? h(options.layout, { path: path.value }, { default: outlet }) : outlet();
      createApp({ render }).mount(selector);

      document.addEventListener("click", (event) => {
        const anchor = (event.target as HTMLElement | null)?.closest?.("a");
        const href = anchor?.getAttribute("href");
        if (!anchor || !href || !href.startsWith("/") || anchor.target === "_blank") return;
        event.preventDefault();
        if (href !== window.location.pathname) {
          window.history.pushState(null, "", href);
          void load(href);
          window.scrollTo(0, 0);
        }
      });
      window.addEventListener("popstate", () => void load(window.location.pathname));
    },
  };
}
