import type { Field, Vow } from "@vow/core";

/**
 * The schema half of `@vow/db` — driver-agnostic SQL + value mapping, derived from an entity's fields.
 * This is the **typed.build seam**: the same builders run under `node:sqlite` (dev) and D1 (prod, =
 * SQLite); only the executor differs. SQLite has affinity, not strict types, so the mapping is simple.
 */

/** A SQLite column type for a field — REAL for number, INTEGER for boolean, else TEXT. */
export function columnType(f: Field): "TEXT" | "REAL" | "INTEGER" {
  if (f.type === "number") return "REAL";
  if (f.type === "boolean") return "INTEGER"; // 0/1, coerced back to a JS bool on read
  return "TEXT"; // text · longtext · select · date · reference (the target's id)
}

/** The default JS value for an absent field — mirrors the generated `create<Name>` factory exactly. */
export function defaultValue(f: Field): string | number | boolean {
  if (f.type === "select") return f.options?.[0] ?? "";
  if (f.type === "number") return 0;
  if (f.type === "boolean") return false;
  return ""; // text · longtext · date · reference
}

/** `CREATE TABLE IF NOT EXISTS` for an entity — an `id` primary key plus one column per field. */
export function createTableSql(entity: Vow): string {
  const cols = entity.fields.map((f) => `  "${f.name}" ${columnType(f)}`);
  const body = ['  "id" TEXT PRIMARY KEY', ...cols].join(",\n");
  return `CREATE TABLE IF NOT EXISTS "${entity.slug}" (\n${body}\n);`;
}
