import { type Component, createApp, h, nextTick, shallowRef } from "vue";

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

/** The route for a path: an exact match (trailing slash ignored), else the `/404` route, else null. */
export function matchRoute(routes: readonly Route[], path: string): Route | null {
  const norm = path.length > 1 ? path.replace(/\/$/, "") : path;
  return routes.find((r) => r.path === norm) ?? routes.find((r) => r.path === "/404") ?? null;
}

/** The built-in fallback shown when no route (and no `/404`) matches — a minimal "not found" page. */
const NotFound: Component = {
  render: () =>
    h("div", { class: "vow-doc" }, [
      h("h1", "Page not found"),
      h("p", "The page at this address could not be found (404)."),
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

/** Scroll to an anchor (after the page rendered), else to the top. */
async function scrollTo(hash: string): Promise<void> {
  await nextTick();
  if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  else window.scrollTo(0, 0);
}

/** Create a router over the given routes (browser-only — uses history + the DOM). */
export function createRouter(routes: readonly Route[], options: RouterOptions = {}): Router {
  const page = shallowRef<Component | null>(null);
  const path = shallowRef("/");

  // Load the page for a pathname (the hash is matched separately — `/guide/x#y` must not 404).
  const load = async (pathname: string): Promise<void> => {
    if (pathname === path.value && page.value) return;
    path.value = pathname;
    const route = matchRoute(routes, pathname);
    page.value = route ? (await route.load()).default : null;
  };

  return {
    async mount(selector) {
      await load(window.location.pathname);
      const outlet = () => h(page.value ?? NotFound);
      const render = (): ReturnType<typeof h> | null =>
        options.layout ? h(options.layout, { path: path.value }, { default: outlet }) : outlet();
      createApp({ render }).mount(selector);
      void scrollTo(window.location.hash);

      document.addEventListener("click", (event) => {
        if (event.defaultPrevented) return; // already handled (e.g. the search's programmatic nav)
        const anchor = (event.target as HTMLElement | null)?.closest?.("a");
        const href = anchor?.getAttribute("href");
        if (!anchor || !href || !href.startsWith("/") || anchor.target === "_blank") return;
        event.preventDefault();
        const url = new URL(href, window.location.origin);
        window.history.pushState(null, "", href);
        void load(url.pathname).then(() => scrollTo(url.hash));
      });
      window.addEventListener("popstate", () => {
        void load(window.location.pathname).then(() => scrollTo(window.location.hash));
      });
    },
  };
}
