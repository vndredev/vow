import { renderVueSfc } from "@vow/component";

/** The canonical component model `renderVueSfc` consumes — derived from its signature, not re-imported. */
type Component = Parameters<typeof renderVueSfc>[0];

/**
 * Vow's layout primitives — structural components for arranging UI (Flex, Grid, Box, Container).
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

/** A flex container. Props mirror the CSS, with ergonomic enum values. */
const flex: Component = {
  doc: [
    "Layout primitive: a flex container. Generated from the canonical component model — do not edit.",
    "Pure structure (no a11y); the computed style maps props to CSS, gap to a @vow/theme token.",
  ],
  imports: [{ from: "vue", names: ["computed"] }],
  name: "Flex",
  props: [
    {
      default: "'row'",
      name: "direction",
      optional: true,
      tsType: "'row' | 'column' | 'row-reverse' | 'column-reverse'",
    },
    {
      default: "'stretch'",
      name: "align",
      optional: true,
      tsType: "'start' | 'center' | 'end' | 'baseline' | 'stretch'",
    },
    {
      default: "'start'",
      name: "justify",
      optional: true,
      tsType: "'start' | 'center' | 'end' | 'between'",
    },
    {
      default: "'nowrap'",
      name: "wrap",
      optional: true,
      tsType: "'nowrap' | 'wrap' | 'wrap-reverse'",
    },
    { default: "0", name: "gap", optional: true, tsType: "number" },
  ],
  setup: [
    EDGE,
    "const style = computed(() =>",
    "  [",
    "    'display: flex',",
    `    \`flex-direction: \${props.direction}\`,`,
    `    \`align-items: \${edge(props.align)}\`,`,
    `    \`justify-content: \${edge(props.justify)}\`,`,
    `    \`flex-wrap: \${props.wrap}\`,`,
    `    props.gap ? \`gap: var(--vow-space-\${props.gap})\` : '',`,
    "  ]",
    "    .filter(Boolean)",
    "    .join('; '),",
    ");",
  ],
  view: {
    attrs: [
      { kind: "static", name: "class", value: "vow-flex" },
      { expr: "style", kind: "bound", name: "style" },
    ],
    children: [{ children: [], kind: "slot" }],
    kind: "element",
    tag: "div",
  },
};

/** A vertical stack — a flex column with a gap. The most common page/form arrangement, as sugar. */
const stack: Component = {
  doc: [
    "Layout primitive: a vertical stack (a flex column with a gap) — the common page/form arrangement.",
    "Pure structure (no a11y); `gap` maps to a @vow/theme spacing token.",
  ],
  imports: [{ from: "vue", names: ["computed"] }],
  name: "Stack",
  props: [{ default: "4", name: "gap", optional: true, tsType: "number" }],
  setup: [
    "const style = computed(() =>",
    `  ['display: flex', 'flex-direction: column', props.gap ? \`gap: var(--vow-space-\${props.gap})\` : '']`,
    "    .filter(Boolean)",
    "    .join('; '),",
    ");",
  ],
  view: {
    attrs: [
      { kind: "static", name: "class", value: "vow-stack" },
      { expr: "style", kind: "bound", name: "style" },
    ],
    children: [{ children: [], kind: "slot" }],
    kind: "element",
    tag: "div",
  },
};

/** A grid container. `columns` is a count (→ equal tracks) or a raw `grid-template-columns` string. */
const grid: Component = {
  doc: [
    "Layout primitive: a grid container. Generated from the canonical component model — do not edit.",
    "Pure structure (no a11y); columns is a count (equal tracks) or a raw template string.",
  ],
  imports: [{ from: "vue", names: ["computed"] }],
  name: "Grid",
  props: [
    { default: "1", name: "columns", optional: true, tsType: "number | string" },
    {
      default: "'stretch'",
      name: "align",
      optional: true,
      tsType: "'start' | 'center' | 'end' | 'baseline' | 'stretch'",
    },
    {
      default: "'start'",
      name: "justify",
      optional: true,
      tsType: "'start' | 'center' | 'end' | 'between'",
    },
    { default: "0", name: "gap", optional: true, tsType: "number" },
  ],
  setup: [
    EDGE,
    "const cols = (c: number | string): string =>",
    `  typeof c === 'number' ? \`repeat(\${c}, minmax(0, 1fr))\` : c;`,
    "const style = computed(() =>",
    "  [",
    "    'display: grid',",
    `    \`grid-template-columns: \${cols(props.columns)}\`,`,
    `    \`align-items: \${edge(props.align)}\`,`,
    `    \`justify-content: \${edge(props.justify)}\`,`,
    `    props.gap ? \`gap: var(--vow-space-\${props.gap})\` : '',`,
    "  ]",
    "    .filter(Boolean)",
    "    .join('; '),",
    ");",
  ],
  view: {
    attrs: [
      { kind: "static", name: "class", value: "vow-grid" },
      { expr: "style", kind: "bound", name: "style" },
    ],
    children: [{ children: [], kind: "slot" }],
    kind: "element",
    tag: "div",
  },
};

/** A generic box: padding from the spacing scale, optional explicit width/height. */
const box: Component = {
  doc: [
    "Layout primitive: a generic box. Generated from the canonical component model — do not edit.",
    "Pure structure (no a11y); padding maps to a @vow/theme token, width/height pass through.",
  ],
  imports: [{ from: "vue", names: ["computed"] }],
  name: "Box",
  props: [
    { default: "0", name: "p", optional: true, tsType: "number" },
    { name: "width", optional: true, tsType: "string" },
    { name: "height", optional: true, tsType: "string" },
  ],
  setup: [
    "const style = computed(() =>",
    "  [",
    `    props.p ? \`padding: var(--vow-space-\${props.p})\` : '',`,
    `    props.width ? \`width: \${props.width}\` : '',`,
    `    props.height ? \`height: \${props.height}\` : '',`,
    "  ]",
    "    .filter(Boolean)",
    "    .join('; '),",
    ");",
  ],
  view: {
    attrs: [
      { kind: "static", name: "class", value: "vow-box" },
      { expr: "style", kind: "bound", name: "style" },
    ],
    children: [{ children: [], kind: "slot" }],
    kind: "element",
    tag: "div",
  },
};

/** A centered content frame: a max-width step from the theme, auto horizontal margins. */
const container: Component = {
  doc: [
    "Layout primitive: a centered content frame. Generated from the canonical model — do not edit.",
    "Pure structure (no a11y); size selects a max-width step from @vow/theme, centered horizontally.",
  ],
  imports: [{ from: "vue", names: ["computed"] }],
  name: "Container",
  props: [{ default: "3", name: "size", optional: true, tsType: "1 | 2 | 3 | 4" }],
  setup: [
    "const style = computed(() =>",
    `  \`max-width: var(--vow-container-\${props.size}); margin-left: auto; margin-right: auto; width: 100%\`,`,
    ");",
  ],
  view: {
    attrs: [
      { kind: "static", name: "class", value: "vow-container" },
      { expr: "style", kind: "bound", name: "style" },
    ],
    children: [{ children: [], kind: "slot" }],
    kind: "element",
    tag: "div",
  },
};

/** Generate the Vue SFC for the Flex layout primitive, rendered from the canonical model. */
export function emitFlexSfc(): string {
  return renderVueSfc(flex);
}

/** Generate the Vue SFC for the Stack layout primitive (a flex column). */
export function emitStackSfc(): string {
  return renderVueSfc(stack);
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

/**
 * The closed layout registry — PascalCase name → its Vue SFC emitter. The single source of vow's
 * layout vocabulary (mirroring `PRIMITIVE_ADAPTERS`): `layoutSfcs()` materialises each pair for the
 * plugin, and `LAYOUT_PRIMITIVES` derives the `## view` names from its keys — adding one is one edit.
 */
export const LAYOUT_ADAPTERS: Record<string, () => string> = {
  Box: emitBoxSfc,
  Container: emitContainerSfc,
  Flex: emitFlexSfc,
  Grid: emitGridSfc,
  Stack: emitStackSfc,
};

/** Every layout primitive as a `{ name, sfc }` pair — the plugin writes these into `.generated/`. */
export function layoutSfcs(): { readonly name: string; readonly sfc: string }[] {
  return Object.entries(LAYOUT_ADAPTERS).map(([name, emit]: readonly [string, () => string]) => ({
    name,
    sfc: emit(),
  }));
}

/** The component names vow provides as layout primitives — the `## view` vocabulary. */
export const LAYOUT_PRIMITIVES: readonly string[] = Object.keys(LAYOUT_ADAPTERS);
