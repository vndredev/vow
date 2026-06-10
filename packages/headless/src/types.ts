/**
 * The shared types the headless primitives speak in. Kept in their own module so a consumer can pull a
 * type with a single `import type` while importing the runtime helpers from `attrs.ts` separately — the
 * strict wall forbids both a mixed inline-`type` import and two imports from one module.
 */

/** A value that may be absent. The primitives never write a bare `undefined`; absence is a missing key. */
export type Maybe<T> = T | undefined;

/** A part's props: ARIA attributes, `data-*` hooks and event handlers, keyed by attribute/handler name. */
export type Props = Record<string, unknown>;
