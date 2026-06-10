import type { Maybe } from "./types.ts";

/**
 * The presence seam — markdown's local mirror of `@vow/core`'s guard, kept here so the prose engine
 * stays self-contained (it depends only on `@vow/component`). The maximal lint wall forbids the
 * `undefined` literal, so "is it set?" narrows through `defined` (a `typeof` test), absence is a
 * `Maybe<T>` value, and the one place `undefined` originates is `NONE` (read off an empty slot).
 */

const ABSENT: { readonly slot?: never } = {};

/** The single absence value for a `Maybe<T>` — read off an empty object's optional slot, no literal. */
export const NONE: Maybe<never> = ABSENT.slot;

/** A type guard: the value is present — a `typeof` test, so the `undefined` literal never appears. */
export function defined<T>(value: Maybe<T>): value is T {
  const absent = "undefined";
  return typeof value !== absent;
}
