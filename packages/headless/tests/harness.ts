import type { Props } from "../src/index.ts";

/**
 * Shared test scaffolding for the headless primitives — kept cast-free so the tests meet the same wall as
 * the source. A `harness` holds state + rebuilds the api after each change; `applyProps` spreads a part's
 * props onto a real element (events via a type guard, no `as`); handler extractors invoke the stored DOM
 * handlers type-safely. Behaviour is driven by REAL events, so it is proven against the platform.
 */

/** A DOM event handler as the primitives store it on a part. */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- DOM event type, inherently mutable.
type Handler = (event: Event) => void;

/** The length of the `on` prefix on a handler prop key (`onClick` -> `click`). */
const HANDLER_PREFIX = 2;

/** A type guard for a stored handler — a predicate, never an assertion, so it passes the strict wall. */
function isHandler(value: unknown): value is Handler {
  return typeof value === "function";
}

/** A stateful harness over a primitive: hold state, rebuild the api after each `set`. */
export interface Harness<TState, TApi> {
  api(): TApi;
  get(): TState;
}

/** Build a harness that feeds the current state into `make` and captures each `set`. */
export function makeHarness<TState, TApi>(
  initial: TState,
  make: (state: TState, set: (next: TState) => void) => TApi,
): Harness<TState, TApi> {
  let state = initial;
  return {
    api(): TApi {
      return make(state, (next) => {
        state = next;
      });
    },
    get(): TState {
      return state;
    },
  };
}

/**
 * Spread a part's props onto a real element: `on*` keys become listeners (via the type guard), and
 * string/number/boolean values become attributes. Absent (omitted) keys simply never appear.
 */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- platform DOM type, inherently mutable.
export function applyProps(element: HTMLElement, props: Readonly<Props>): void {
  for (const [key, value] of Object.entries(props)) {
    if (key.startsWith("on") && isHandler(value)) {
      element.addEventListener(key.slice(HANDLER_PREFIX).toLowerCase(), value);
    } else if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      element.setAttribute(key, String(value));
    }
  }
}

/** Invoke a stored handler (e.g. `onClick`) directly with the given event, type-safely. */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- DOM event type, inherently mutable.
export function invokeHandler(props: Readonly<Props>, name: string, event: Event): void {
  const handler = props[name];
  if (isHandler(handler)) {
    handler(event);
  }
}

/** Create an element of `tag`, spread the part-props onto it, set its text, and return it. */
export function mount(tag: string, props: Readonly<Props>, text = ""): HTMLElement {
  const element = document.createElement(tag);
  applyProps(element, props);
  if (text !== "") {
    element.textContent = text;
  }
  return element;
}
