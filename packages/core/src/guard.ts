/**
 * The presence seam — the type guards `@vow/core` uses instead of touching the `undefined` literal.
 *
 * The maximal lint wall forbids the `undefined` literal (eslint `no-undefined`), so every "is it set?"
 * narrows through `defined`, and every absent return is a `Maybe<T>` (the function simply returns nothing
 * — an implicit `undefined` — never the literal). `isRecord` is the YAML "plain object" guard.
 */

/** A value that may be absent — the explicit name for `T | undefined` across the write/read seams. */
export type Maybe<T> = T | undefined;

/** A type guard: the value is present — `typeof` test, so the `undefined` literal never appears. */
export function defined<T>(value: Maybe<T>): value is T {
  const absent = "undefined";
  return typeof value !== absent;
}

/**
 * Map a `Maybe<T>` through `fn`, passing absence through untouched. The single exit (and the absent
 * branch returning the narrowed input, not the `undefined` literal) keeps `consistent-return` and
 * `no-undefined` both green — the read-side mirror of serialize's `whenSet`.
 */
export function mapDefined<T, Result>(value: Maybe<T>, fn: (set: T) => Result): Maybe<Result> {
  if (defined(value)) {
    return fn(value);
  }
  return value;
}

/** A type guard: the value is a plain object (not null, not an array) — the YAML record shape. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Coerce a YAML value to a record — a plain object passes through, anything else becomes empty. */
export function asRecord(value: unknown): Record<string, unknown> {
  if (isRecord(value)) {
    return value;
  }
  return {};
}
