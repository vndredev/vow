import type { ReadonlyField, ReadonlyVow, SqlColumn } from "./types.ts";
import { FIELD_KINDS } from "@vow/core";

/**
 * The schema half of `@vow/db` — driver-agnostic SQL + value mapping, derived from an entity's fields via
 * `@vow/core`'s `FIELD_KINDS` registry. This is the **typed.build seam**: the same builders run under
 * `node:sqlite` (dev) and D1 (prod, = SQLite); only the executor differs. SQLite has affinity, not strict
 * types, so the mapping is simple.
 */

/** A SQLite column type for a field — REAL for number, INTEGER for a 0/1 boolean, else TEXT. */
export function columnType(field: ReadonlyField): SqlColumn {
  return FIELD_KINDS[field.type].sqlColumn;
}

/** The empty default JS value per SQLite column — mirrors the generated `create<Name>` factory exactly. */
const COLUMN_DEFAULT: Record<SqlColumn, string | number | boolean> = {
  INTEGER: false,
  REAL: 0,
  TEXT: "",
};

/** The default JS value for an absent field — mirrors the generated `create<Name>` factory exactly. A
 *  select carries its first option; every other type takes the empty value for its column. */
export function defaultValue(field: ReadonlyField): string | number | boolean {
  if (field.type === "select") {
    return field.options?.[0] ?? "";
  }
  return COLUMN_DEFAULT[FIELD_KINDS[field.type].sqlColumn];
}

/** `CREATE TABLE IF NOT EXISTS` for an entity — an `id` primary key plus one column per field. */
export function createTableSql(entity: ReadonlyVow): string {
  const cols = entity.fields.map((field) => `  "${field.name}" ${columnType(field)}`);
  const body = ['  "id" TEXT PRIMARY KEY', ...cols].join(",\n");
  return `CREATE TABLE IF NOT EXISTS "${entity.slug}" (\n${body}\n);`;
}
