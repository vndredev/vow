import { renderVueSfc, type Component } from "@vow/component";

/**
 * vow's primitive emitter — generates the thin framework adapter over a `@vow/headless` primitive.
 *
 * The logic AND the a11y are proven in the core (tested against the DOM, framework-free). The adapter
 * binds the framework's reactivity and spreads the props — it carries only `class` + the core's
 * `data-*` state hooks, no logic of its own. vow's own base look lives in a swappable theme
 * (`@vow/theme`) that targets those hooks, so the look can be re-skinned without touching the adapter.
 *
 * The adapter is described as a canonical `Component` and rendered by the Vue adapter (`renderVueSfc`),
 * so React/Solid become further adapters over the same model — see `@vow/component`.
 *
 * Shape follows Reka UI: a `<button role="checkbox">` control wrapping an indicator part, with state
 * exposed as `data-state` on each part for the theme to hook.
 */

/** The checkbox adapter as a canonical Component: props + headless glue (setup) + the markup tree. */
const checkbox: Component = {
  name: "Checkbox",
  doc: [
    "Generated checkbox adapter over @vow/headless. Logic + a11y live in the core — do not edit.",
    "Carries class + data-* hooks only; vow's base look lives in @vow/theme (swappable).",
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
    tag: "span",
    attrs: [
      { kind: "spread", expr: "api.rootProps" },
      { kind: "static", name: "class", value: "vow-checkbox" },
    ],
    children: [
      {
        kind: "element",
        tag: "button",
        attrs: [
          { kind: "spread", expr: "api.controlProps" },
          { kind: "bound", name: "aria-label", expr: "label" },
          { kind: "static", name: "class", value: "vow-checkbox__control" },
        ],
        children: [
          {
            kind: "element",
            tag: "span",
            attrs: [
              { kind: "spread", expr: "api.indicatorProps" },
              { kind: "static", name: "class", value: "vow-checkbox__indicator" },
            ],
            children: [{ kind: "text", text: "✓" }],
          },
        ],
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

/** The collapsible (disclosure) adapter as a canonical Component: a button trigger + a v-show region. */
const collapsible: Component = {
  name: "Collapsible",
  doc: [
    "Generated collapsible adapter over @vow/headless. Logic + a11y live in the core — do not edit.",
    "Carries class + data-* hooks only; vow's base look lives in @vow/theme (swappable).",
  ],
  imports: [
    { from: "vue", names: ["computed", "useId"] },
    { from: "@vow/headless", names: ["collapsible"] },
  ],
  props: [
    { name: "modelValue", tsType: "boolean" },
    { name: "label", tsType: "string" },
    { name: "disabled", tsType: "boolean", optional: true },
  ],
  events: [{ name: "update:modelValue", payload: "boolean" }],
  setup: [
    "const uid = useId();",
    "const api = computed(() =>",
    "  collapsible({ open: props.modelValue, id: uid, disabled: props.disabled }, (next) =>",
    '    emit("update:modelValue", next.open),',
    "  ),",
    ");",
  ],
  view: {
    kind: "element",
    tag: "div",
    attrs: [
      { kind: "spread", expr: "api.rootProps" },
      { kind: "static", name: "class", value: "vow-collapsible" },
    ],
    children: [
      {
        kind: "element",
        tag: "button",
        attrs: [
          { kind: "spread", expr: "api.triggerProps" },
          { kind: "static", name: "class", value: "vow-collapsible__trigger" },
        ],
        children: [{ kind: "interp", expr: "label" }],
      },
      {
        kind: "element",
        tag: "div",
        attrs: [
          { kind: "spread", expr: "api.contentProps" },
          { kind: "cond", type: "show", expr: "api.open" },
          { kind: "static", name: "class", value: "vow-collapsible__content" },
        ],
        children: [{ kind: "slot", children: [] }],
      },
    ],
  },
};

/** Generate the Vue collapsible adapter (over @vow/headless), rendered from the canonical model. */
export function emitCollapsibleSfc(): string {
  return renderVueSfc(collapsible);
}
