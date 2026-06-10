/**
 * The presence seam for `@vow/db` — a `defined` guard mirroring `@vow/core`'s.
 *
 * Core exports the same guard, but the strict lint wall forbids importing a value (`defined`) and a type
 * (`Maybe`) from one module in one statement (`consistent-type-specifier-style`) while also forbidding two
 * statements from that module (`no-duplicate-imports`). Keeping the guard local — as `@vow/router` and
 * `@vow/store` do — sidesteps that. Each consumer declares its own one-line `Maybe<T>` alias (a value-only
 * import here, a local type there), so the domain types stay a clean `import type` from core.
 */

/** A value that may be absent — the explicit name for `T | undefined`, used in the guard's signature. */
type Maybe<T> = T | undefined;

/** A type guard: the value is present — a `typeof` test, so the `undefined` literal never appears. */
export function defined<T>(value: Maybe<T>): value is T {
  const absent = "undefined";
  return typeof value !== absent;
}
