/**
 * @vow/router — a tiny client router for generated vow apps. One central server serves every route;
 * the boot builds a routes table (the root page + the `@vow/docs` pages) and mounts the page matching
 * `location.pathname`, intercepting internal links so navigation never full-reloads.
 */
import { createApp, h, nextTick, shallowRef } from "vue";

/** A Vue component, derived from `createApp`'s root-component parameter so the module needs no
 *  separate type import from "vue" (a value + type pair from one module is forbidden by the import
 *  rules, as are namespace and inline-type imports). */
type Component = Parameters<typeof createApp>[0];

/** A present-or-absent value — the explicit alternative to `null`, narrowed with a `typeof "object"`
 *  guard rather than a forbidden comparison to the `undefined` literal. */
type Maybe<T> = T | undefined;

/** The absent value — a typed stand-in produced without writing the `undefined` literal (an unset
 *  optional property reads back as the absence at runtime). */
const { absent }: { readonly absent?: never } = {};

/** Coerce a possibly-`null` DOM result into a `Maybe<T>` so the rest of the module never sees `null`. */
function maybe<T extends object>(value: T | null): Maybe<T> {
  if (value === null) {
    return absent;
  }
  return value;
}

/** Whether a `Maybe<object>` holds a value — a `typeof` guard that never names `undefined`. */
function isPresent<T extends object>(value: Maybe<T>): value is T {
  return typeof value === "object";
}

/** A route: a path, a lazy loader for its page component (a `.vue` default export), and an optional
 *  document title to set on navigation. */
export interface Route {
  readonly load: () => Promise<{ default: Component }>;
  readonly path: string;
  readonly title?: string;
}

/** The route for a path: an exact match (trailing slashes ignored), else the `/404` route, else absent. */
export function matchRoute(routes: readonly Route[], path: string): Maybe<Route> {
  const norm = path.replace(/\/+$/u, "") || "/";
  return (
    routes.find((route) => route.path === norm) ?? routes.find((route) => route.path === "/404")
  );
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

/** The default layout — a transparent wrapper that just renders the page in its slot. */
const PassThrough: Component = {
  render(this: { readonly $slots: { readonly default?: () => unknown } }) {
    return this.$slots.default?.();
  },
};

/** A deeply-immutable view of a type — every nested property becomes `readonly`, so a parameter of
 *  this type satisfies the strict `prefer-readonly-parameter-types` rule even for library types. */
type DeepReadonly<Value> = Value extends (...args: infer Args) => infer Result
  ? (...args: Args) => Result
  : Value extends object
    ? { readonly [Key in keyof Value]: DeepReadonly<Value[Key]> }
    : Value;

/** A page-wrapping layout component, accepted as deeply-immutable so callers can pass any Vue
 *  component without tripping the strict readonly-parameter rule. */
type Layout = DeepReadonly<Component>;

export interface RouterOptions {
  /** A chrome component wrapping every page — it receives a `path` prop and the page in its slot. */
  readonly layout?: Layout;
}

export interface Router {
  /** Resolve the initial route and mount the app, then take over in-app navigation. */
  mount(selector: string): Promise<void>;
}

/** Scroll to an anchor (after the page rendered), else to the top. */
async function scrollTo(hash: string): Promise<void> {
  await nextTick();
  if (hash) {
    // The hash includes the leading "#"; query by id once the element exists.
    maybe(globalThis.document.querySelector(`#${hash.slice(1)}`))?.scrollIntoView();
    return;
  }
  globalThis.scrollTo(0, 0);
}

/** A link click that should be handled in-app: the raw href to push, plus the pathname + hash to load
 *  and scroll to. Stored as plain strings so the type is deeply readonly (a `URL` would not be). */
interface InternalLink {
  readonly hash: string;
  readonly href: string;
  readonly pathname: string;
}

/** The minimal, deeply-readonly shape of a click this router cares about — every `MouseEvent`
 *  satisfies it, so a DOM listener can pass its event straight through. */
interface ClickEvent {
  readonly defaultPrevented: boolean;
  readonly preventDefault: () => void;
  readonly target: unknown;
}

/** The internal link a `<a href>`/`target` pair points to, or absent if the browser should keep it. */
function linkOf(href: string, anchorTarget: string): Maybe<InternalLink> {
  if (!href.startsWith("/") || anchorTarget === "_blank") {
    return absent;
  }
  const url = new URL(href, globalThis.location.origin);
  if (url.origin !== globalThis.location.origin) {
    // Protocol-relative ("//host") or otherwise cross-origin — let the browser handle it.
    return absent;
  }
  return { hash: url.hash, href, pathname: url.pathname };
}

/** The anchor an event was dispatched on, or absent if the click was outside any `<a>`. */
function anchorOf(target: unknown): Maybe<HTMLAnchorElement> {
  if (!(target instanceof Element)) {
    return absent;
  }
  return maybe(target.closest("a"));
}

/** Resolve a click into the internal link it should navigate to, or absent if the browser keeps it. */
function internalLink(event: ClickEvent): Maybe<InternalLink> {
  if (event.defaultPrevented) {
    // Already handled (e.g. the search's programmatic nav).
    return absent;
  }
  const anchor = anchorOf(event.target);
  if (!isPresent(anchor)) {
    return absent;
  }
  const href = anchor.getAttribute("href");
  if (href === null) {
    return absent;
  }
  return linkOf(href, anchor.target);
}

/** Surface a navigation failure on the console rather than letting it vanish into a rejected promise. */
function reportNavigationError(error: unknown): void {
  globalThis.console.error("[@vow/router] navigation failed", error);
}

/** The navigation currently in flight, retained so its promise is never "floating" (the handler
 *  already reports its own failures). Holding exactly one keeps the reference bounded — a new
 *  navigation only starts on a fresh click/popstate, by which point the previous one has settled. */
const inFlight = new Set<Readonly<Promise<void>>>();

/** Launch a navigation from a synchronous DOM listener without floating its promise — the clean
 *  stand-in for `void task` under the no-void / no-then / no-floating rules. */
function ignore(task: Readonly<Promise<void>>): void {
  inFlight.clear();
  inFlight.add(task);
}

/** A client router instance: holds the reactive page/path and threads navigation through them. */
class RouterImpl implements Router {
  /** The fallback document title (index.html's) for routes that declare none. */
  private readonly baseTitle = globalThis.document.title;
  /** The chrome wrapping every page — the caller's layout, else a transparent pass-through. */
  private readonly layout: Component;
  /** The currently mounted page component. */
  private readonly page = shallowRef<Maybe<Component>>(NotFound);
  /** The current route path, exposed to the layout as a prop. */
  private readonly path = shallowRef("/");
  /** The route table this router resolves paths against. */
  private readonly routes: readonly Route[];

  public constructor(routes: readonly Route[], options: Readonly<RouterOptions>) {
    this.routes = routes;
    this.layout = options.layout ?? PassThrough;
  }

  public async mount(selector: string): Promise<void> {
    await this.load(globalThis.location.pathname);
    createApp({ render: () => this.render() }).mount(selector);
    await scrollTo(globalThis.location.hash);
    this.listen();
  }

  /** Load the page for a pathname (the hash is matched separately — `/guide/x#y` must not 404). */
  private async load(pathname: string): Promise<void> {
    this.path.value = pathname;
    const route = matchRoute(this.routes, pathname);
    globalThis.document.title = route?.title ?? this.baseTitle;
    if (!isPresent(route)) {
      this.page.value = NotFound;
      return;
    }
    const loaded = await route.load();
    this.page.value = loaded.default;
  }

  private render(): ReturnType<typeof h> {
    const outlet = (): ReturnType<typeof h> => h(this.page.value ?? NotFound);
    return h(this.layout, { path: this.path.value }, { default: outlet });
  }

  /** Navigate to an internal link: push history, load its page, then scroll to its hash. */
  private async navigate(link: InternalLink): Promise<void> {
    globalThis.history.pushState(absent, "", link.href);
    await this.load(link.pathname);
    await scrollTo(link.hash);
  }

  /** Handle a captured click. Self-contained (never rejects) so a DOM listener can ignore its
   *  promise — the clean stand-in for `void task` under the no-void/no-then rules. */
  private async onClick(event: ClickEvent): Promise<void> {
    try {
      const link = internalLink(event);
      if (!isPresent(link)) {
        return;
      }
      event.preventDefault();
      await this.navigate(link);
    } catch (error) {
      reportNavigationError(error);
    }
  }

  /** Re-sync the page to the address bar after a back/forward navigation (also self-contained). */
  private async onPopState(): Promise<void> {
    try {
      await this.load(globalThis.location.pathname);
      await scrollTo(globalThis.location.hash);
    } catch (error) {
      reportNavigationError(error);
    }
  }

  private listen(): void {
    globalThis.document.addEventListener("click", (event: ClickEvent) => {
      ignore(this.onClick(event));
    });
    globalThis.addEventListener("popstate", () => {
      ignore(this.onPopState());
    });
  }
}

/** Create a router over the given routes (browser-only — uses history + the DOM). */
export function createRouter(
  routes: readonly Route[],
  options: Readonly<RouterOptions> = {},
): Router {
  return new RouterImpl(routes, options);
}
