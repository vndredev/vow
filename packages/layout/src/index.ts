import { renderVueSfc, type Component } from "@vow/component";

/**
 * vow's layout primitives — structural components for arranging UI (Flex, Grid, Box, Container).
 *
 * Per the primitives rule (docs/guide/primitives.md), a `<div style="display:flex">` is something
 * the browser does natively — so these carry NO ARIA, no keyboard logic, no @vow/headless core.
 * They are pure structure: a canonical `Component` whose `view` is a styled element with a `<slot>`,
 * rendered by `renderVueSfc`. Riding the same model means a future React/Solid adapter renders them
 * too. They are the vocabulary a view's `## view` composes (that grammar lands in its own step).
 *
 * Styling is a computed inline `style` STRING (not an object) so the generated SFC type-checks
 * against Vue's `StyleValue` without depending on csstype's per-property unions. Spacing maps to
 * `@vow/theme` tokens (`--vow-space-<n>`, `--vow-container-<size>`); undefined until the theme defines
 * the scale, which is harmless (the component runs bare, the design system layers on).
 */

/** Translate ergonomic edge keywords to their CSS values; pass everything else through. */
const EDGE =
  "const edge = (v: string): string =>\n  v === 'start' ? 'flex-start' : v === 'end' ? 'flex-end' : v === 'between' ? 'space-between' : v;";

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
    EDGE,
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

/** A grid container. `columns` is a count (→ equal tracks) or a raw `grid-template-columns` string. */
const grid: Component = {
  name: "Grid",
  doc: [
    "Layout primitive: a grid container. Generated from the canonical component model — do not edit.",
    "Pure structure (no a11y); columns is a count (equal tracks) or a raw template string.",
  ],
  imports: [{ from: "vue", names: ["computed"] }],
  props: [
    { name: "columns", tsType: "number | string", optional: true, default: "1" },
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
    { name: "gap", tsType: "number", optional: true, default: "0" },
  ],
  setup: [
    EDGE,
    "const cols = (c: number | string): string =>",
    "  typeof c === 'number' ? `repeat(${c}, minmax(0, 1fr))` : c;",
    "const style = computed(() =>",
    "  [",
    "    'display: grid',",
    "    `grid-template-columns: ${cols(props.columns)}`,",
    "    `align-items: ${edge(props.align)}`,",
    "    `justify-content: ${edge(props.justify)}`,",
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
      { kind: "static", name: "class", value: "vow-grid" },
      { kind: "bound", name: "style", expr: "style" },
    ],
    children: [{ kind: "slot", children: [] }],
  },
};

/** A generic box: padding from the spacing scale, optional explicit width/height. */
const box: Component = {
  name: "Box",
  doc: [
    "Layout primitive: a generic box. Generated from the canonical component model — do not edit.",
    "Pure structure (no a11y); padding maps to a @vow/theme token, width/height pass through.",
  ],
  imports: [{ from: "vue", names: ["computed"] }],
  props: [
    { name: "p", tsType: "number", optional: true, default: "0" },
    { name: "width", tsType: "string", optional: true },
    { name: "height", tsType: "string", optional: true },
  ],
  setup: [
    "const style = computed(() =>",
    "  [",
    "    props.p ? `padding: var(--vow-space-${props.p})` : '',",
    "    props.width ? `width: ${props.width}` : '',",
    "    props.height ? `height: ${props.height}` : '',",
    "  ]",
    "    .filter(Boolean)",
    "    .join('; '),",
    ");",
  ],
  view: {
    kind: "element",
    tag: "div",
    attrs: [
      { kind: "static", name: "class", value: "vow-box" },
      { kind: "bound", name: "style", expr: "style" },
    ],
    children: [{ kind: "slot", children: [] }],
  },
};

/** A centered content frame: a max-width step from the theme, auto horizontal margins. */
const container: Component = {
  name: "Container",
  doc: [
    "Layout primitive: a centered content frame. Generated from the canonical model — do not edit.",
    "Pure structure (no a11y); size selects a max-width step from @vow/theme, centered horizontally.",
  ],
  imports: [{ from: "vue", names: ["computed"] }],
  props: [{ name: "size", tsType: "1 | 2 | 3 | 4", optional: true, default: "3" }],
  setup: [
    "const style = computed(() =>",
    "  `max-width: var(--vow-container-${props.size}); margin-left: auto; margin-right: auto; width: 100%`,",
    ");",
  ],
  view: {
    kind: "element",
    tag: "div",
    attrs: [
      { kind: "static", name: "class", value: "vow-container" },
      { kind: "bound", name: "style", expr: "style" },
    ],
    children: [{ kind: "slot", children: [] }],
  },
};

/** Generate the Vue SFC for the Flex layout primitive, rendered from the canonical model. */
export function emitFlexSfc(): string {
  return renderVueSfc(flex);
}

/** Generate the Vue SFC for the Grid layout primitive. */
export function emitGridSfc(): string {
  return renderVueSfc(grid);
}

/** Generate the Vue SFC for the Box layout primitive. */
export function emitBoxSfc(): string {
  return renderVueSfc(box);
}

/** Generate the Vue SFC for the Container layout primitive. */
export function emitContainerSfc(): string {
  return renderVueSfc(container);
}

/** Every layout primitive as a `{ name, sfc }` pair — the plugin writes these into `.generated/`. */
export function layoutSfcs(): { readonly name: string; readonly sfc: string }[] {
  return [
    { name: "Flex", sfc: emitFlexSfc() },
    { name: "Grid", sfc: emitGridSfc() },
    { name: "Box", sfc: emitBoxSfc() },
    { name: "Container", sfc: emitContainerSfc() },
  ];
}

/** The component names vow provides as layout primitives — the `## view` vocabulary. */
export const LAYOUT_PRIMITIVES: readonly string[] = ["Flex", "Grid", "Box", "Container"];
