import { renderVueSfc, type Component } from "@vow/component";

/**
 * vow's layout primitives — structural components for arranging UI (Flex, Grid, ... to come).
 *
 * Per the primitives rule (docs/guide/primitives.md), a `<div style="display:flex">` is something
 * the browser does natively — so these carry NO ARIA, no keyboard logic, no @vow/headless core.
 * They are pure structure: a canonical `Component` whose `view` is a styled element with a `<slot>`,
 * rendered by `renderVueSfc`. Riding the same model means a future React/Solid adapter renders them
 * too. They are the vocabulary a view's `## tree` composes (that grammar lands in its own step).
 *
 * Styling is a computed inline `style` STRING (not an object) so the generated SFC type-checks
 * against Vue's `StyleValue` without depending on csstype's per-property unions. `gap` resolves to a
 * `@vow/theme` spacing token (`--vow-space-<n>`); undefined until the theme defines the scale, which
 * is harmless (the component runs bare, the design system layers on).
 */

/** A flex container. Props mirror the CSS, with ergonomic enum values (Radix-style). */
const flex: Component = {
  name: "Flex",
  doc: [
    "Layout primitive: a flex container. Generated from the canonical component model — do not edit.",
    "Pure structure (no a11y); the computed style maps props to CSS, gap to a @vow/theme token.",
  ],
  imports: [{ from: "vue", names: ["computed"] }],
  props: [
    {
      name: "direction",
      tsType: "'row' | 'column' | 'row-reverse' | 'column-reverse'",
      optional: true,
      default: "'row'",
    },
    {
      name: "align",
      tsType: "'start' | 'center' | 'end' | 'baseline' | 'stretch'",
      optional: true,
      default: "'stretch'",
    },
    {
      name: "justify",
      tsType: "'start' | 'center' | 'end' | 'between'",
      optional: true,
      default: "'start'",
    },
    {
      name: "wrap",
      tsType: "'nowrap' | 'wrap' | 'wrap-reverse'",
      optional: true,
      default: "'nowrap'",
    },
    { name: "gap", tsType: "number", optional: true, default: "0" },
  ],
  setup: [
    "const edge = (v: string): string =>",
    "  v === 'start' ? 'flex-start' : v === 'end' ? 'flex-end' : v === 'between' ? 'space-between' : v;",
    "const style = computed(() =>",
    "  [",
    "    'display: flex',",
    "    `flex-direction: ${props.direction}`,",
    "    `align-items: ${edge(props.align)}`,",
    "    `justify-content: ${edge(props.justify)}`,",
    "    `flex-wrap: ${props.wrap}`,",
    "    props.gap ? `gap: var(--vow-space-${props.gap})` : '',",
    "  ]",
    "    .filter(Boolean)",
    "    .join('; '),",
    ");",
  ],
  view: {
    kind: "element",
    tag: "div",
    attrs: [
      { kind: "static", name: "class", value: "vow-flex" },
      { kind: "bound", name: "style", expr: "style" },
    ],
    children: [{ kind: "slot", children: [] }],
  },
};

/** Generate the Vue SFC for the Flex layout primitive, rendered from the canonical model. */
export function emitFlexSfc(): string {
  return renderVueSfc(flex);
}

/** Every layout primitive as a `{ name, sfc }` pair — the plugin writes these into `.generated/`. */
export function layoutSfcs(): { readonly name: string; readonly sfc: string }[] {
  return [{ name: "Flex", sfc: emitFlexSfc() }];
}
