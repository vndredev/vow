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

export interface Router {
  /** Resolve the initial route and mount the app, then take over in-app navigation. */
  mount(selector: string): Promise<void>;
}

/** Create a router over the given routes (browser-only — uses history + the DOM). */
export function createRouter(routes: readonly Route[]): Router {
  const page = shallowRef<Component | null>(null);

  const load = async (path: string): Promise<void> => {
    const route = matchRoute(routes, path);
    page.value = route ? (await route.load()).default : null;
  };

  return {
    async mount(selector) {
      await load(window.location.pathname);
      createApp({ render: () => (page.value ? h(page.value) : null) }).mount(selector);

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
