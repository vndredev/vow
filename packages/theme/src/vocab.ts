/**
 * vow's design language tokens and intent resolution.
 *
 * The ONE source of truth for:
 * - Token axes: variant, tone, size, density — the raw vocabulary that emitters write and vow.css styles
 * - Intent→token resolution: e.g., button intent "primary" resolves to variant·tone·size
 * - Context defaults: e.g., a button in a form footer defaults to intent "primary"
 *
 * Each token vocabulary is an `as const` array (order is the emitted union order, so derived type
 * strings stay byte-stable). The coverage test pins every emittable combination to a matching
 * vow.css selector — the seam that can't lie.
 */

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// LAYER 1: TOKENS — the raw, orthogonal vocabulary
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════

/** The visual treatment: fill, tint, border, bare, text. */
export const VARIANTS = ["solid", "soft", "outline", "ghost", "link"] as const;

/** The semantic colour role. */
export const TONES = ["neutral", "accent", "success", "warning", "danger", "info"] as const;

/** The control scale. */
export const SIZES = ["xs", "sm", "md", "lg", "xl"] as const;

/** The spacing scale of a surface. */
export const DENSITIES = ["comfortable", "compact"] as const;

export type Variant = (typeof VARIANTS)[number];
export type Tone = (typeof TONES)[number];
export type Size = (typeof SIZES)[number];
export type Density = (typeof DENSITIES)[number];

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// LAYER 2: INTENT RESOLUTION — map intent→tokens
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════

export interface TokenResolution {
  variant?: Variant;
  tone?: Tone;
  size?: Size;
  density?: Density;
}

/** Button/action intents and their token resolutions. */
export const BUTTON_INTENTS = {
  primary: { variant: "solid", tone: "accent", size: "md" } as const,
  secondary: { variant: "soft", tone: "neutral", size: "md" } as const,
  subtle: { variant: "ghost", tone: "neutral", size: "sm" } as const,
  row: { variant: "ghost", tone: "neutral", size: "sm" } as const,
  toolbar: { variant: "ghost", tone: "neutral", size: "sm" } as const,
  destructive: { variant: "outline", tone: "danger", size: "md" } as const,
} as const;

export type ButtonIntent = keyof typeof BUTTON_INTENTS;

/** Badge/status intents and their token resolutions. */
export const BADGE_INTENTS = {
  planned: { variant: "soft", tone: "neutral" } as const,
  doing: { variant: "soft", tone: "accent" } as const,
  done: { variant: "soft", tone: "success" } as const,
  blocked: { variant: "soft", tone: "danger" } as const,
  "at-risk": { variant: "soft", tone: "warning" } as const,
} as const;

export type BadgeIntent = keyof typeof BADGE_INTENTS;

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// LAYER 3: CONTEXT DEFAULTS — sensible defaults per context
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════

export const BUTTON_CONTEXT_DEFAULTS = {
  /** A button in a table/list row's actions cell. */
  row: "row" as const,
  /** A button in a form footer (first button primary, rest secondary). */
  "form-footer": "primary" as const,
  /** A button in a toolbar/page header. */
  toolbar: "toolbar" as const,
  /** A button in a dialog footer (confirm is primary, cancel is subtle). */
  "dialog-footer": "primary" as const,
} as const;

export type ButtonContext = keyof typeof BUTTON_CONTEXT_DEFAULTS;

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════

/** Render a vocabulary as a TypeScript single-quoted literal union (e.g. `'sm' | 'md' | 'lg'`) — the exact
 *  string an emitter inlines as a prop's `tsType`, so the generated SFC stays byte-stable. */
export function unionType(values: readonly string[]): string {
  return values.map((value) => `'${value}'`).join(" | ");
}

// Backward compat for existing code
export const BADGE_VARIANTS = TONES;
export const BUTTON_VARIANTS = VARIANTS;
export const SIZE_DEFAULT = "md" as const;
export type BadgeVariant = Tone;
export type ButtonVariant = Variant;
