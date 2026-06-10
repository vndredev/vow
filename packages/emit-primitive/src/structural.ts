import { primitive } from "./define.ts";

/**
 * The structural primitives with their own props — button, badge, field and callout. None has a
 * `@vow/headless` core: `<button>` is already accessible, a badge/callout is inert, a field's a11y is
 * the emitted markup itself (label `for`, error `role=alert`). Each carries only its theme surface
 * (`data-variant`/`data-size` hooks) + structure; vow's base look lives in a swappable theme (`@vow/theme`).
 */

/**
 * Generate the Vue button adapter — the ONE structural control with no `@vow/headless` core: `<button>`
 * is already accessible, so there's no a11y logic to prove. It exists only for the variant/size theme
 * surface, carried as `data-variant`/`data-size` hooks the theme styles. A default slot holds the
 * content, falling back to the `label` prop for the common spec-driven case.
 */
export const emitButtonSfc = primitive({
  doc: [
    "Generated button — the one structural control with NO headless core (<button> is accessible).",
    "Carries only the variant/size theme surface; vow's base look lives in @vow/theme (swappable).",
  ],
  imports: [
    { default: "Icon", from: "@vow/icons/Icon.vue" },
    { from: "@vow/icons", names: ["type IconName"] },
  ],
  name: "Button",
  props: [
    { default: "''", name: "label", optional: true, tsType: "string" },
    { name: "icon", optional: true, tsType: "IconName" },
    {
      default: "'default'",
      name: "variant",
      optional: true,
      tsType: "'default' | 'outline' | 'ghost'",
    },
    { default: "'md'", name: "size", optional: true, tsType: "'sm' | 'md' | 'lg'" },
    { default: "'button'", name: "type", optional: true, tsType: "'button' | 'submit'" },
  ],
  view: {
    attrs: [
      { kind: "static", name: "class", value: "vow-button" },
      { expr: "type", kind: "bound", name: "type" },
      { expr: "variant", kind: "bound", name: "data-variant" },
      { expr: "size", kind: "bound", name: "data-size" },
    ],
    children: [
      {
        attrs: [
          { expr: "icon", kind: "cond", type: "if" },
          { expr: "icon", kind: "bound", name: "name" },
        ],
        children: [],
        kind: "component",
        name: "Icon",
      },
      { children: [{ expr: "label", kind: "interp" }], kind: "slot" },
    ],
    kind: "element",
    tag: "button",
  },
});

/**
 * Generate the Vue badge adapter — a structural status/label chip with no headless core (it's inert
 * text). Carries only the variant theme surface (status colours) + an optional leading icon; the look
 * lives in @vow/theme.
 */
export const emitBadgeSfc = primitive({
  doc: [
    "Generated badge — a structural status/label chip (no headless core; it's inert text).",
    "Carries only the variant theme surface; vow's base look lives in @vow/theme (swappable).",
  ],
  imports: [
    { default: "Icon", from: "@vow/icons/Icon.vue" },
    { from: "@vow/icons", names: ["type IconName"] },
  ],
  name: "Badge",
  props: [
    { default: "''", name: "label", optional: true, tsType: "string" },
    { name: "icon", optional: true, tsType: "IconName" },
    {
      default: "'neutral'",
      name: "variant",
      optional: true,
      tsType: "'neutral' | 'accent' | 'success' | 'warning' | 'danger'",
    },
  ],
  view: {
    attrs: [
      { kind: "static", name: "class", value: "vow-badge" },
      { expr: "variant", kind: "bound", name: "data-variant" },
    ],
    children: [
      {
        attrs: [
          { expr: "icon", kind: "cond", type: "if" },
          { expr: "icon", kind: "bound", name: "name" },
        ],
        children: [],
        kind: "component",
        name: "Icon",
      },
      { children: [{ expr: "label", kind: "interp" }], kind: "slot" },
    ],
    kind: "element",
    tag: "span",
  },
});

/**
 * Generate the Vue field wrapper — a structural label + control + optional description and error, with
 * no headless core. The control is the default slot; the caller (a form) owns the id and passes it as
 * `controlId`, so the `<label for>` and the control's `id` line up. The error is a live `role="alert"`
 * region keyed `<controlId>-error`, the target for the control's `aria-describedby`. Look in @vow/theme.
 */
export const emitFieldSfc = primitive({
  doc: [
    "Generated field wrapper — a label + control + optional description and error. No headless core:",
    "pure structure + a11y wiring (label `for`, error `role=alert`); the look lives in @vow/theme.",
  ],
  name: "Field",
  props: [
    { name: "label", tsType: "string" },
    { name: "controlId", tsType: "string" },
    { name: "description", optional: true, tsType: "string" },
    { name: "error", optional: true, tsType: "string" },
  ],
  view: {
    attrs: [{ kind: "static", name: "class", value: "vow-field" }],
    children: [
      {
        attrs: [
          { kind: "static", name: "class", value: "vow-field__label" },
          { expr: "controlId", kind: "bound", name: "for" },
        ],
        children: [{ expr: "label", kind: "interp" }],
        kind: "element",
        tag: "label",
      },
      { children: [], kind: "slot" },
      {
        attrs: [
          { kind: "static", name: "class", value: "vow-field__desc" },
          { expr: "description", kind: "cond", type: "if" },
        ],
        children: [{ expr: "description", kind: "interp" }],
        kind: "element",
        tag: "p",
      },
      {
        attrs: [
          { kind: "static", name: "class", value: "vow-field__error" },
          { expr: "controlId + '-error'", kind: "bound", name: "id" },
          { kind: "static", name: "role", value: "alert" },
          { expr: "error", kind: "cond", type: "if" },
        ],
        children: [{ expr: "error", kind: "interp" }],
        kind: "element",
        tag: "p",
      },
    ],
    kind: "element",
    tag: "div",
  },
});

/** Generate the Vue callout adapter — a structural notice (tip/info/warning/danger), the reusable `:::`. */
export const emitCalloutSfc = primitive({
  doc: [
    "Generated callout — a structural notice; the variant tints it (the reusable `:::` block).",
  ],
  name: "Callout",
  props: [
    {
      default: "'info'",
      name: "variant",
      optional: true,
      tsType: "'tip' | 'info' | 'warning' | 'danger'",
    },
    { name: "title", optional: true, tsType: "string" },
  ],
  view: {
    attrs: [
      { kind: "static", name: "class", value: "vow-callout" },
      { expr: "variant", kind: "bound", name: "data-variant" },
    ],
    children: [
      {
        attrs: [
          { expr: "title", kind: "cond", type: "if" },
          { kind: "static", name: "class", value: "vow-callout__title" },
        ],
        children: [{ expr: "title", kind: "interp" }],
        kind: "element",
        tag: "p",
      },
      { children: [], kind: "slot" },
    ],
    kind: "element",
    tag: "div",
  },
});
