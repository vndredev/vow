import type { Maybe, ReadonlyField, ReadonlyVow } from "@vow/core";
import { pascalCase } from "@vow/component";

/**
 * The scenarios an `emit entity` vow proves, derived from its fields — these ARE the generated test
 * names. `ensureEntity` is the fail-fast guard every public emitter runs first, so a non-entity vow
 * never reaches the field-driven generation.
 */

/** One proven scenario: its claim, and (for a rejection scenario) the required field it omits. */
export interface EntityScenario {
  readonly claim: string;
  readonly missing?: Maybe<ReadonlyField>;
}

/** Fail fast unless the vow is an `emit entity` — every public emitter runs this first. */
export function ensureEntity(vow: ReadonlyVow): void {
  if (vow.fulfills?.kind !== "emit" || vow.fulfills.as !== "entity") {
    throw new Error(`emit-entity: vow "${vow.slug}" is not an \`emit entity\``);
  }
}

/** The scenarios an `emit entity` vow proves, derived from its fields — these ARE the test names. */
export function entityScenarios(vow: ReadonlyVow): readonly EntityScenario[] {
  const name = pascalCase(vow.slug);
  const required = vow.fields.filter((field) => field.required);
  return [
    { claim: `A valid ${name} is built from its required fields` },
    ...required.map((field) => ({
      claim: `${name} without '${field.name}' is rejected`,
      missing: field,
    })),
  ];
}
