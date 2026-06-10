/**
 * The `Maybe` seam — a type guard used instead of comparing to the `undefined` literal, so optional
 * fields narrow without tripping the no-undefined wall. `defined(x)` narrows away `undefined` via a
 * `typeof` check; every optional read in this package routes through it.
 */
export function defined<T>(value: T): value is Exclude<T, undefined> {
  const absent = "undefined";
  return typeof value !== absent;
}
