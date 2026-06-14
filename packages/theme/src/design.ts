/**
 * The design language — the committed resolution from author INTENT to the raw token vocabulary
 * (variant · tone · size · density). One pure, total, dependency-free source of truth: the DSL names an
 * intent, the emitters resolve it here, and `@vow/theme` styles one rule per token combination.
 * `docs/guide/design.md` is the prose spec this module mirrors 1:1.
 *
 * Button + Badge read these axes directly (`variant`·`tone`·`size`·`density` → `data-*`); the only legacy
 * vocabulary left in ./vocab.ts is `BADGE_VARIANTS` (the observability status set) and `SIZE_DEFAULT`.
 *
 * Scope: the button/action + status/badge intents — the families the spec resolves to concrete
 * variant·tone·size. The text, spacing, and surface intent families (design.md) resolve to a different
 * token set (type scale, spacing, elevation) and land as their own follow-up.
 */

/** Layer 1 — the raw token axes. Orthogonal: `variant` is the treatment, `tone` is the colour. */
export const VARIANTS = ["solid", "soft", "outline", "ghost", "link"] as const;
export const TONES = ["neutral", "accent", "success", "warning", "danger", "info"] as const;
export const CONTROL_SIZES = ["xs", "sm", "md", "lg", "xl"] as const;
export const DENSITIES = ["comfortable", "compact"] as const;

/** A visual treatment (fill, tint, border, bare, text). */
export type Variant = (typeof VARIANTS)[number];

/** A semantic colour role. */
export type Tone = (typeof TONES)[number];

/** A control scale. */
export type ControlSize = (typeof CONTROL_SIZES)[number];

/** The spacing scale of a surface. */
export type Density = (typeof DENSITIES)[number];

/** The tokens an action/button intent resolves to. */
export interface ActionTokens {
  readonly size: ControlSize;
  readonly tone: Tone;
  readonly variant: Variant;
}

/** The tokens a status/badge intent resolves to (no size — a badge reads one scale). */
export interface StatusTokens {
  readonly tone: Tone;
  readonly variant: Variant;
}

/** Layer 2 — button / action intents → tokens. One surface has exactly one `primary`. */
export const BUTTON_INTENTS = {
  destructive: { size: "md", tone: "danger", variant: "outline" },
  primary: { size: "md", tone: "accent", variant: "solid" },
  row: { size: "sm", tone: "neutral", variant: "ghost" },
  secondary: { size: "md", tone: "neutral", variant: "soft" },
  subtle: { size: "sm", tone: "neutral", variant: "ghost" },
  toolbar: { size: "sm", tone: "neutral", variant: "ghost" },
} as const satisfies Record<string, ActionTokens>;

/** A named button role. */
export type ButtonIntent = keyof typeof BUTTON_INTENTS;

/** Layer 2 — status / badge intents → tokens. A status reads its tone from its meaning, never a swatch. */
export const STATUS_INTENTS = {
  "at-risk": { tone: "warning", variant: "soft" },
  blocked: { tone: "danger", variant: "soft" },
  doing: { tone: "accent", variant: "soft" },
  done: { tone: "success", variant: "soft" },
  planned: { tone: "neutral", variant: "soft" },
} as const satisfies Record<string, StatusTokens>;

/** A named status role. */
export type StatusIntent = keyof typeof STATUS_INTENTS;

/** A context's button defaults — the lead button's intent, and the intent every later button takes. */
export interface ContextDefault {
  readonly lead: ButtonIntent;
  readonly rest: ButtonIntent;
}

/** Layer 3 — context defaults: where a button sits picks its intent, so the author writes only the
 *  deviation. A footer leads with `primary`, then `secondary`; a row's actions cell is all `row`. */
export const BUTTON_CONTEXT_DEFAULTS = {
  "dialog-footer": { lead: "primary", rest: "subtle" },
  "form-footer": { lead: "primary", rest: "secondary" },
  row: { lead: "row", rest: "row" },
  toolbar: { lead: "toolbar", rest: "toolbar" },
} as const satisfies Record<string, ContextDefault>;

/** A surface a button can sit in, carrying a default intent. */
export type ButtonContext = keyof typeof BUTTON_CONTEXT_DEFAULTS;

/** Resolve a button intent to its tokens. Total over `ButtonIntent`. */
export function resolveButton(intent: ButtonIntent): ActionTokens {
  return BUTTON_INTENTS[intent];
}

/** Resolve a status intent to its tokens. Total over `StatusIntent`. */
export function resolveStatus(intent: StatusIntent): StatusTokens {
  return STATUS_INTENTS[intent];
}

/** The default button intent for a context — the lead button (the common, zero-ceremony case). */
export function buttonContextDefault(context: ButtonContext): ButtonIntent {
  return BUTTON_CONTEXT_DEFAULTS[context].lead;
}
