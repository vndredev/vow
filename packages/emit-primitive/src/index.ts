import { renderVueSfc, type Component } from "@vow/component";

/**
 * vow's primitive emitter — generates the thin framework adapter over a `@vow/headless` primitive.
 *
 * The logic AND the a11y are proven in the core (tested against the DOM, framework-free). The adapter
 * binds the framework's reactivity and spreads the props — and is **unstyled**: it only carries
 * `class` + the core's `data-*` hooks. Styling lives in a swappable theme (`@vow/theme`), so the
 * component runs bare (Zag-style) and the design system layers on without touching it.
 *
 * The adapter is described as a canonical `Component` and rendered by the Vue adapter (`renderVueSfc`),
 * so React/Solid become further adapters over the same model — see `@vow/component`.
 */

/** The checkbox adapter as a canonical Component: props + headless glue (setup) + the markup tree. */
const checkbox: Component = {
  name: "Checkbox",
  doc: [
    "Generated checkbox adapter over @vow/headless. Logic + a11y live in the core — do not edit.",
    "Unstyled: class + data-* hooks only; styling lives in @vow/theme (swappable).",
  ],
  imports: [
    { from: "vue", names: ["computed"] },
    { from: "@vow/headless", names: ["checkbox"] },
  ],
  props: [
    { name: "modelValue", tsType: "boolean" },
    { name: "label", tsType: "string" },
    { name: "disabled", tsType: "boolean", optional: true },
  ],
  events: [{ name: "update:modelValue", payload: "boolean" }],
  setup: [
    "const api = computed(() =>",
    "  checkbox({ checked: props.modelValue, disabled: props.disabled }, (next) =>",
    '    emit("update:modelValue", next.checked),',
    "  ),",
    ");",
  ],
  view: {
    kind: "element",
    tag: "label",
    attrs: [
      { kind: "spread", expr: "api.rootProps" },
      { kind: "static", name: "class", value: "vow-checkbox" },
    ],
    children: [
      {
        kind: "element",
        tag: "span",
        attrs: [
          { kind: "spread", expr: "api.controlProps" },
          { kind: "bound", name: "aria-label", expr: "label" },
          { kind: "static", name: "class", value: "vow-checkbox__box" },
        ],
        children: [{ kind: "interp", expr: 'api.checked ? "✓" : ""' }],
      },
      {
        kind: "element",
        tag: "span",
        attrs: [
          { kind: "spread", expr: "api.labelProps" },
          { kind: "static", name: "class", value: "vow-checkbox__label" },
        ],
        children: [{ kind: "interp", expr: "label" }],
      },
    ],
  },
};

/** Generate the Vue checkbox adapter (over @vow/headless), rendered from the canonical model. */
export function emitCheckboxSfc(): string {
  return renderVueSfc(checkbox);
}
