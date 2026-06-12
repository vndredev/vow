/**
 * The type-only surface the emitters import from. Re-exporting the canonical-component types
 * (`@vow/component`) and the vow/field types (`@vow/core`) here lets every emitter import its *values*
 * (`renderVueSfc`, `pascalCase`, `defined`) straight from those packages and its *types* from this one
 * module — two distinct specifiers per package, so the strict import wall holds (no inline type
 * specifiers alongside values, no duplicate import of one module).
 */
export type { Attr, Component, ImportDecl, UiNode } from "@vow/component";
export type { FieldCell, FieldControl, Maybe, ReadonlyField, ReadonlyVow } from "@vow/core";
export type { BadgeVariant, TimelineEntry } from "@vow/observability";
export type { FeedLayout } from "./feed-layout.ts";
export type { IssueLayout } from "./issue-layout.ts";
