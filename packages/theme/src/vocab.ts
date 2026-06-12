/**
 * The variant + size vocabulary — the ONE source for the `data-variant`/`data-size` values the emitters
 * write and `vow.css` styles. Each vocabulary is an `as const` array (order is the emitted union order, so
 * the derived type strings stay byte-stable); the emitters derive their prop unions from it, observability
 * derives its `BadgeVariant`, and a coverage test pins every value to a matching `vow.css` selector. Adding
 * a value here is the single edit that flows to the emit and the theme sides at once. Dependency-free.
 */

/** The badge status colours (a soft tint per semantic token) — the `vow-badge[data-variant]` vocabulary. */
export const BADGE_VARIANTS = ["neutral", "accent", "success", "warning", "danger"] as const;

/** The button surfaces — the `vow-button[data-variant]` vocabulary. */
export const BUTTON_VARIANTS = ["default", "outline", "ghost"] as const;

/** The control sizes — the `vow-button[data-size]` vocabulary. */
export const SIZES = ["sm", "md", "lg"] as const;

/** The base-styled size — the default the base `.vow-button` rule carries, so it has no own `[data-size]`
 *  selector (the others tune off it). The coverage test exempts exactly this one value. */
export const SIZE_DEFAULT = "md";

/** A badge status colour. */
export type BadgeVariant = (typeof BADGE_VARIANTS)[number];

/** A button surface. */
export type ButtonVariant = (typeof BUTTON_VARIANTS)[number];

/** A control size. */
export type Size = (typeof SIZES)[number];

/** Render a vocabulary as a TypeScript single-quoted literal union (e.g. `'sm' | 'md' | 'lg'`) — the exact
 *  string an emitter inlines as a prop's `tsType`, so the generated SFC stays byte-stable. */
export function unionType(values: readonly string[]): string {
  return values.map((value) => `'${value}'`).join(" | ");
}

/* The design language — intent → token resolution (the target the primitives are rebuilt against). The
   legacy vocabulary above stays until each primitive migrates; both are exposed from the one entry. */
export * from "./design.ts";
