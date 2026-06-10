import type { ReadonlyVow, Vow } from "@vow/core";

/**
 * The readonly→mutable bridge for the un-cleaned emit layer.
 *
 * The strict wall requires every parameter to be deeply readonly (`prefer-readonly-parameter-types`), so
 * this package types every vow parameter as `ReadonlyVow`. The `@vow/emit-*` packages it forwards to still
 * declare mutable `Vow` parameters, and a deep-readonly value is not structurally assignable to one (zod
 * infers a mutable `Field.options: string[]`). The two requirements are genuinely contradictory until the
 * emit layer is cleaned to accept `ReadonlyVow`; this single, named seam drops the readonly view (a widen,
 * not a real mutation — the emitters only read) so the contradiction lives in exactly one place.
 */

/** Present a deeply-readonly vow to an emitter that still declares a mutable `Vow` parameter. */
export function mutable(vow: ReadonlyVow): Vow {
  // oxlint-disable-next-line no-unsafe-type-assertion -- emitters declare mutable Vow but only read it
  return vow as Vow;
}

/** A `slug → mutable Vow` index built from the entity vows — the shape the entity emitters take. */
export function mutableIndex(entities: readonly ReadonlyVow[]): Map<string, Vow> {
  const index = new Map<string, Vow>();
  for (const entity of entities) {
    index.set(entity.slug, mutable(entity));
  }
  return index;
}
