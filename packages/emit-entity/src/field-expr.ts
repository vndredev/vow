import { FIELD_KINDS } from "@vow/core";
import type { ReadonlyField } from "./types.ts";
import { humanizeFieldName } from "@vow/component";

/**
 * Field-value expressions for the generated entity module — the zod type, the factory default, and the
 * test sample for a single field. The per-type facts (zod base, default, sample, string-ish) come from
 * `@vow/core`'s `FIELD_KINDS` registry; only the data-driven cases (a `select`'s options, a `reference`'s
 * target) special-case here. A required string-ish field is `.min(1, "<name> is required")` so an empty
 * submit is rejected with a per-field message.
 */

/** True for the string-ish field types — text, longtext, date, and a reference (the target's id). */
function isStringy(field: ReadonlyField): boolean {
  return FIELD_KINDS[field.type].isStringy;
}

/** The base zod type for a field, before the required-string refinement. */
function baseZodType(field: ReadonlyField): string {
  if (field.type === "select") {
    const opts = (field.options ?? []).map((option) => JSON.stringify(option)).join(", ");
    if (opts) {
      return `z.enum([${opts}])`;
    }
    return "z.string()";
  }
  return FIELD_KINDS[field.type].zodBase;
}

/**
 * The zod schema for a field — `z.enum` for select, `z.number`/`z.boolean` for those, else a string
 * (text/longtext/date/reference). A required string-ish field is `.min(1, "<name> is required")`, so an
 * empty submit is rejected with a per-field message the form can surface; the inferred TS type follows.
 */
export function zodType(field: ReadonlyField): string {
  if (field.required && isStringy(field)) {
    return `z.string().min(1, ${JSON.stringify(`${humanizeFieldName(field.name)} is required`)})`;
  }
  return baseZodType(field);
}

/** A default-value expression for the factory. */
export function defaultExpr(field: ReadonlyField): string {
  if (field.type === "select") {
    return JSON.stringify(field.options?.[0] ?? "");
  }
  return FIELD_KINDS[field.type].defaultExpr;
}

/** A sample-value expression for the generated tests. */
export function sampleExpr(field: ReadonlyField): string {
  if (field.type === "select") {
    return JSON.stringify(field.options?.[0] ?? "");
  }
  if (field.type === "reference") {
    // A sample target id.
    return JSON.stringify(`${field.ref ?? "ref"}_1`);
  }
  return FIELD_KINDS[field.type].sampleExpr;
}
