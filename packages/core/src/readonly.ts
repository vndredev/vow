import type { Field, Vow } from "./vow.ts";

/**
 * A structural deep-readonly: every property, at every depth and through arrays, becomes readonly.
 * The `Field`/`Vow` shapes are already readonly at the top, but zod infers a mutable `string[]` for
 * `Field.options` (and `Record<string, unknown>` values for `seed`); wrapping a parameter in
 * `DeepReadonly` closes that last hole, so the strict `prefer-readonly-parameter-types` rule is
 * satisfied without a cast. The write side still constructs plain `Vow`s — the readonly view is
 * parameter-only.
 */
export type DeepReadonly<T> = T extends (infer Item)[]
  ? readonly DeepReadonly<Item>[]
  : T extends readonly (infer Item)[]
    ? readonly DeepReadonly<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
      : T;

/** A vow, read-only to its leaves — the parameter shape every read-only helper accepts. */
export type ReadonlyVow = DeepReadonly<Vow>;

/** A field, read-only to its leaves. */
export type ReadonlyField = DeepReadonly<Field>;
