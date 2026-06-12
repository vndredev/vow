/**
 * The type-only surface the emitters import from. Re-exporting the vow/field types (`@vow/core`) here
 * lets every emitter import its *values* (`pascalCase`, `defined`) straight from those packages and its
 * *types* from this one module — two distinct specifiers per package, so the strict import wall holds
 * (no inline type specifiers alongside values, no duplicate import of one module).
 */
export type { Maybe, ReadonlyField, ReadonlyVow } from "@vow/core";
