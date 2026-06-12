/**
 * The type-only surface `@vow/db` imports from `@vow/core`. Re-exporting the vow/field types here lets a
 * module import its *value* (`FIELD_KINDS`) straight from `@vow/core` and its *types* from this one module —
 * two distinct specifiers per package, so the strict import wall holds (no value + top-level `import type`
 * from one source colliding under `no-duplicate-imports`).
 */
export type { ReadonlyField, ReadonlyVow, SqlColumn } from "@vow/core";
