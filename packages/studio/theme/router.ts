import { shallowRef, type Component, type ShallowRef } from "vue";

/** A page module a route resolves to: the compiled `.md` SFC (its default export is the component). */
export interface PageModule {
  readonly default: Component;
}

export interface RouteDef {
  readonly path: string;
  readonly component: () => Promise<PageModule>;
}

export interface StudioRouter {
  readonly path: ShallowRef<string>;
  readonly page: ShallowRef<Component | null>;
  go(to: string): Promise<void>;
  load(to: string): Promise<void>;
}

/** Match a clean path to its route — exact, else the "/404" route, else null. */
export function matchRoute(routes: readonly RouteDef[], path: string): RouteDef | null {
  return routes.find((r) => r.path === path) ?? routes.find((r) => r.path === "/404") ?? null;
}

/**
 * A tiny SPA-after-hydration router. The site is statically rendered, so first paint needs no JS; this
 * only takes over in-app navigation. `load` resolves a path's page (dynamic import); `go` also pushes
 * history. The client entry intercepts internal `<a>` clicks to call `go`.
 */
export function createStudioRouter(routes: readonly RouteDef[], initial: string): StudioRouter {
  const path = shallowRef(initial);
  const page = shallowRef<Component | null>(null);
  const load = async (to: string): Promise<void> => {
    const route = matchRoute(routes, to);
    page.value = route ? (await route.component()).default : null;
  };
  const go = async (to: string): Promise<void> => {
    path.value = to;
    if (typeof history !== "undefined") history.pushState(null, "", to);
    await load(to);
  };
  return { path, page, go, load };
}
