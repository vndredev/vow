import type { ReadonlyField, ReadonlyVow } from "./types.ts";
import { defined, isEmitEntity } from "@vow/core";

/** Throw with a clear message when `entity` is not an `emit entity` — the shared precondition. */
export function assertEmitEntity(entity: ReadonlyVow, label: string): void {
  if (!isEmitEntity(entity)) {
    throw new Error(`emit-view: \`${label}:\` target "${entity.slug}" must be an \`emit entity\``);
  }
  if (entity.fields.length === 0) {
    throw new Error(
      `emit-view: \`${label}:\` target "${entity.slug}" needs >=1 field to render a list/cards/board`,
    );
  }
}

/** The select field named `by` on `entity` — throws when it is missing or not a select. */
export function selectField(entity: ReadonlyVow, by: string, label: string): ReadonlyField {
  const field = entity.fields.find((candidate) => candidate.name === by);
  if (!defined(field) || field.type !== "select") {
    throw new Error(
      `emit-view: \`${label}: { by: ${by} }\` must reference a select field of "${entity.slug}"`,
    );
  }
  return field;
}
