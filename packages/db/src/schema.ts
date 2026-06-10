import type { ReadonlyField, ReadonlyVow } from "@vow/core";

/**
 * The schema half of `@vow/db` — driver-agnostic SQL + value mapping, derived from an entity's fields.
 * This is the **typed.build seam**: the same builders run under `node:sqlite` (dev) and D1 (prod, =
 * SQLite); only the executor differs. SQLite has affinity, not strict types, so the mapping is simple.
 */

/** A SQLite column type for a field — REAL for number, INTEGER for boolean, else TEXT. */
export function columnType(field: ReadonlyField): "TEXT" | "REAL" | "INTEGER" {
  if (field.type === "number") {
    return "REAL";
  }
  // INTEGER 0/1, coerced back to a JS bool on read.
  if (field.type === "boolean") {
    return "INTEGER";
  }
  // TEXT covers text, longtext, select, date, and reference (the target's id).
  return "TEXT";
}

/** The default JS value for an absent field — mirrors the generated `create<Name>` factory exactly. */
export function defaultValue(field: ReadonlyField): string | number | boolean {
  if (field.type === "select") {
    return field.options?.[0] ?? "";
  }
  if (field.type === "number") {
    return 0;
  }
  if (field.type === "boolean") {
    return false;
  }
  // The empty string covers text, longtext, date, and reference.
  return "";
}

/** `CREATE TABLE IF NOT EXISTS` for an entity — an `id` primary key plus one column per field. */
export function createTableSql(entity: ReadonlyVow): string {
  const cols = entity.fields.map((field) => `  "${field.name}" ${columnType(field)}`);
  const body = ['  "id" TEXT PRIMARY KEY', ...cols].join(",\n");
  return `CREATE TABLE IF NOT EXISTS "${entity.slug}" (\n${body}\n);`;
}
