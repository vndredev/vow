import type { ReadonlyField } from "@vow/core";

/**
 * Field-value expressions for the generated entity module — the zod type, the factory default, and the
 * test sample for a single field. Field types map: text/longtext/date/reference -> `z.string()`,
 * number -> `z.number()`, boolean -> `z.boolean()`, select -> `z.enum([...])`. A required string-ish
 * field is `.min(1, "<name> is required")` so an empty submit is rejected with a per-field message.
 */

const DEFAULT: Record<"boolean" | "date" | "longtext" | "number" | "text", string> = {
  boolean: "false",
  date: '""',
  longtext: '""',
  number: "0",
  text: '""',
};
const SAMPLE: Record<"boolean" | "date" | "longtext" | "number" | "text", string> = {
  boolean: "true",
  date: '"2026-01-01"',
  longtext: '"x"',
  number: "1",
  text: '"x"',
};

/** True for the string-ish field types — text, longtext, date, and a reference (the target's id). */
function isStringy(field: ReadonlyField): boolean {
  return (
    field.type === "text" ||
    field.type === "longtext" ||
    field.type === "date" ||
    field.type === "reference"
  );
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
  if (field.type === "number") {
    return "z.number()";
  }
  if (field.type === "boolean") {
    return "z.boolean()";
  }
  // Text, longtext, date, reference (the target's id) are all strings.
  return "z.string()";
}

/**
 * The zod schema for a field — `z.enum` for select, `z.number`/`z.boolean` for those, else a string
 * (text/longtext/date/reference). A required string-ish field is `.min(1, "<name> is required")`, so an
 * empty submit is rejected with a per-field message the form can surface; the inferred TS type follows.
 */
export function zodType(field: ReadonlyField): string {
  if (field.required && isStringy(field)) {
    return `z.string().min(1, ${JSON.stringify(`${field.name} is required`)})`;
  }
  return baseZodType(field);
}

/** A default-value expression for the factory. */
export function defaultExpr(field: ReadonlyField): string {
  if (field.type === "select") {
    return JSON.stringify(field.options?.[0] ?? "");
  }
  if (field.type === "reference") {
    // No referent yet.
    return '""';
  }
  return DEFAULT[field.type];
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
  return SAMPLE[field.type];
}
