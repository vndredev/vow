/**
 * The residual theme vocabulary — what survives the migration to the four-axis design language
 * (`./design.ts`: variant · tone · size · density, the source the emitters now read). Two things remain
 * here: `BADGE_VARIANTS` (the legacy status set observability narrows against for the timeline) and
 * `SIZE_DEFAULT` (the base-styled button size the coverage test exempts). Plus `unionType`, the helper the
 * emitters inline to render a prop's literal union. Each is an `as const` so derived strings stay
 * byte-stable. Dependency-free.
 */

/** The badge status colours (a soft tint per semantic token) — the legacy status vocabulary observability
 *  still narrows against (`variantForType`/`statusVariant`). The four-axis emitters read `TONES` from
 *  `./design.ts`; this stays only for the observability → timeline status mapping. */
export const BADGE_VARIANTS = ["neutral", "accent", "success", "warning", "danger"] as const;

/** The base-styled control size — the default the base `.vow-button` rule carries, so it has no own
 *  `[data-size]` selector (the others tune off it). The coverage test exempts exactly this one value. */
export const SIZE_DEFAULT = "md";

/** A badge status colour. */
export type BadgeVariant = (typeof BADGE_VARIANTS)[number];

/** Render a vocabulary as a TypeScript single-quoted literal union (e.g. `'sm' | 'md' | 'lg'`) — the exact
 *  string an emitter inlines as a prop's `tsType`, so the generated SFC stays byte-stable. */
export function unionType(values: readonly string[]): string {
  return values.map((value) => `'${value}'`).join(" | ");
}

/* The design language — intent → token resolution (the target the primitives are rebuilt against). The
   legacy vocabulary above stays until each primitive migrates; both are exposed from the one entry. */
export * from "./design.ts";
