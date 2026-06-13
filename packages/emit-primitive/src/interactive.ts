import { primitive } from "./define.ts";

/**
 * The interactive form-control adapters over `@vow/headless` — checkbox, collapsible, tabs, switch and
 * radio-group. Each binds a `v-model` value through the headless core (where the logic AND the a11y are
 * proven, framework-free) and spreads the core's props; it carries only `class` + the `data-*` state
 * hooks, no logic of its own. vow's base look lives in a swappable theme (`@vow/theme`) over those hooks.
 *
 * Each adapter is described as a canonical component and rendered by the Vue adapter (`renderVueSfc`, via
 * `primitive`), so React/Solid become further adapters over the same model — see `@vow/component`.
 */

/** Generate the Vue checkbox adapter: props + headless glue (setup) + the markup tree. */
export const emitCheckboxSfc = primitive({
  doc: [
    "Generated checkbox adapter over @vow/headless. Logic + a11y live in the core — do not edit.",
    "Carries class + data-* hooks only; vow's base look lives in @vow/theme (swappable).",
  ],
  events: [{ name: "update:modelValue", payload: "boolean" }],
  imports: [
    { from: "vue", names: ["computed"] },
    { from: "@vow/headless", names: ["checkbox"] },
  ],
  name: "Checkbox",
  props: [
    { default: "false", name: "modelValue", optional: true, tsType: "boolean" },
    { name: "label", tsType: "string" },
    { name: "disabled", optional: true, tsType: "boolean" },
    { name: "describedBy", optional: true, tsType: "string" },
    { name: "invalid", optional: true, tsType: "boolean" },
  ],
  setup: [
    "const api = computed(() =>",
    "  checkbox({ checked: props.modelValue, disabled: props.disabled }, (next) =>",
    '    emit("update:modelValue", next.checked),',
    "  ),",
    ");",
  ],
  view: {
    attrs: [
      { expr: "api.rootProps", kind: "spread" },
      { kind: "static", name: "class", value: "vow-checkbox" },
    ],
    children: [
      {
        attrs: [
          { expr: "api.controlProps", kind: "spread" },
          { expr: "label", kind: "bound", name: "aria-label" },
          { expr: "describedBy", kind: "bound", name: "aria-describedby" },
          { expr: "invalid", kind: "bound", name: "aria-invalid" },
          { kind: "static", name: "class", value: "vow-checkbox__control" },
        ],
        children: [
          {
            attrs: [
              { expr: "api.indicatorProps", kind: "spread" },
              { kind: "static", name: "class", value: "vow-checkbox__indicator" },
            ],
            children: [{ kind: "text", text: "✓" }],
            kind: "element",
            tag: "span",
          },
        ],
        kind: "element",
        tag: "button",
      },
      {
        attrs: [
          { expr: "api.labelProps", kind: "spread" },
          { kind: "static", name: "class", value: "vow-checkbox__label" },
        ],
        children: [{ expr: "label", kind: "interp" }],
        kind: "element",
        tag: "span",
      },
    ],
    kind: "element",
    tag: "span",
  },
});

/** Generate the Vue collapsible (disclosure) adapter: a button trigger + a v-show region. */
export const emitCollapsibleSfc = primitive({
  doc: [
    "Generated collapsible adapter over @vow/headless. Logic + a11y live in the core — do not edit.",
    "Carries class + data-* hooks only; vow's base look lives in @vow/theme (swappable).",
  ],
  events: [{ name: "update:modelValue", payload: "boolean" }],
  imports: [
    { from: "vue", names: ["computed", "useId"] },
    { from: "@vow/headless", names: ["collapsible"] },
  ],
  name: "Collapsible",
  props: [
    { name: "modelValue", tsType: "boolean" },
    { name: "label", tsType: "string" },
    { name: "disabled", optional: true, tsType: "boolean" },
  ],
  setup: [
    "const uid = useId();",
    "const api = computed(() =>",
    "  collapsible({ open: props.modelValue, id: uid, disabled: props.disabled }, (next) =>",
    '    emit("update:modelValue", next.open),',
    "  ),",
    ");",
  ],
  view: {
    attrs: [
      { expr: "api.rootProps", kind: "spread" },
      { kind: "static", name: "class", value: "vow-collapsible" },
    ],
    children: [
      {
        attrs: [
          { expr: "api.triggerProps", kind: "spread" },
          { kind: "static", name: "class", value: "vow-collapsible__trigger" },
        ],
        children: [{ expr: "label", kind: "interp" }],
        kind: "element",
        tag: "button",
      },
      {
        attrs: [
          { expr: "api.contentProps", kind: "spread" },
          { expr: "api.open", kind: "cond", type: "show" },
          { kind: "static", name: "class", value: "vow-collapsible__content" },
        ],
        children: [{ children: [], kind: "slot" }],
        kind: "element",
        tag: "div",
      },
    ],
    kind: "element",
    tag: "div",
  },
});

/** Generate the Vue tabs adapter: a roving tablist + v-show panels with per-item slots. */
export const emitTabsSfc = primitive({
  doc: [
    "Generated tabs adapter over @vow/headless. Logic + a11y live in the core — do not edit.",
    "Carries class + data-* hooks only; vow's base look lives in @vow/theme (swappable).",
  ],
  events: [{ name: "update:modelValue", payload: "string" }],
  imports: [
    { from: "vue", names: ["computed", "useId"] },
    { from: "@vow/headless", names: ["tabs"] },
  ],
  name: "Tabs",
  props: [
    { name: "modelValue", tsType: "string" },
    { name: "items", tsType: "string[]" },
  ],
  setup: [
    "const uid = useId();",
    "const api = computed(() =>",
    "  tabs({ value: props.modelValue, items: props.items, id: uid }, (next) =>",
    '    emit("update:modelValue", next.value),',
    "  ),",
    ");",
  ],
  view: {
    attrs: [
      { expr: "api.rootProps", kind: "spread" },
      { kind: "static", name: "class", value: "vow-tabs" },
    ],
    children: [
      {
        attrs: [
          { expr: "api.listProps", kind: "spread" },
          { kind: "static", name: "class", value: "vow-tabs__list" },
        ],
        children: [
          {
            attrs: [
              { expr: "api.tabProps(item)", kind: "spread" },
              { kind: "static", name: "class", value: "vow-tabs__tab" },
            ],
            children: [{ expr: "item", kind: "interp" }],
            for: { as: "item", each: "items", key: "item" },
            kind: "element",
            tag: "button",
          },
        ],
        kind: "element",
        tag: "div",
      },
      {
        attrs: [
          { expr: "api.panelProps(item)", kind: "spread" },
          { expr: "item === modelValue", kind: "cond", type: "show" },
          { kind: "static", name: "class", value: "vow-tabs__panel" },
        ],
        children: [{ children: [], kind: "slot", nameExpr: "item" }],
        for: { as: "item", each: "items", key: "item" },
        kind: "element",
        tag: "div",
      },
    ],
    kind: "element",
    tag: "div",
  },
});

/** Generate the Vue switch (toggle) adapter: a `<button role=switch>` track + a thumb part. */
export const emitSwitchSfc = primitive({
  doc: [
    "Generated switch adapter over @vow/headless. Logic + a11y live in the core — do not edit.",
    "Carries class + data-* hooks only; vow's base look lives in @vow/theme (swappable).",
  ],
  events: [{ name: "update:modelValue", payload: "boolean" }],
  imports: [
    { from: "vue", names: ["computed"] },
    { from: "@vow/headless", names: ["switch_"] },
  ],
  name: "Switch",
  props: [
    { default: "false", name: "modelValue", optional: true, tsType: "boolean" },
    { name: "label", tsType: "string" },
    { name: "disabled", optional: true, tsType: "boolean" },
  ],
  setup: [
    "const api = computed(() =>",
    "  switch_({ checked: props.modelValue, disabled: props.disabled }, (next) =>",
    '    emit("update:modelValue", next.checked),',
    "  ),",
    ");",
  ],
  view: {
    attrs: [
      { expr: "api.rootProps", kind: "spread" },
      { kind: "static", name: "class", value: "vow-switch" },
    ],
    children: [
      {
        attrs: [
          { expr: "api.controlProps", kind: "spread" },
          { expr: "label", kind: "bound", name: "aria-label" },
          { kind: "static", name: "class", value: "vow-switch__control" },
        ],
        children: [
          {
            attrs: [
              { expr: "api.thumbProps", kind: "spread" },
              { kind: "static", name: "class", value: "vow-switch__thumb" },
            ],
            children: [],
            kind: "element",
            tag: "span",
          },
        ],
        kind: "element",
        tag: "button",
      },
      {
        attrs: [
          { expr: "api.labelProps", kind: "spread" },
          { kind: "static", name: "class", value: "vow-switch__label" },
        ],
        children: [{ expr: "label", kind: "interp" }],
        kind: "element",
        tag: "span",
      },
    ],
    kind: "element",
    tag: "span",
  },
});

/** Generate the Vue radio-group adapter: a `role=radiogroup` of `role=radio` buttons. */
export const emitRadioGroupSfc = primitive({
  doc: [
    "Generated radio-group adapter over @vow/headless. Logic + a11y live in the core — do not edit.",
    "Carries class + data-* hooks only; vow's base look lives in @vow/theme (swappable).",
  ],
  events: [{ name: "update:modelValue", payload: "string" }],
  imports: [
    { from: "vue", names: ["computed"] },
    { from: "@vow/headless", names: ["radioGroup"] },
  ],
  name: "RadioGroup",
  props: [
    { default: '""', name: "modelValue", optional: true, tsType: "string" },
    { name: "options", tsType: "string[]" },
    { name: "label", tsType: "string" },
    { name: "disabled", optional: true, tsType: "boolean" },
  ],
  setup: [
    "const api = computed(() =>",
    "  radioGroup({ value: props.modelValue, options: props.options, disabled: props.disabled }, (next) =>",
    '    emit("update:modelValue", next.value),',
    "  ),",
    ");",
  ],
  view: {
    attrs: [
      { expr: "api.rootProps", kind: "spread" },
      { expr: "label", kind: "bound", name: "aria-label" },
      { kind: "static", name: "class", value: "vow-radio" },
    ],
    children: [
      {
        attrs: [
          { expr: "api.radioProps(option)", kind: "spread" },
          { kind: "static", name: "class", value: "vow-radio__option" },
        ],
        children: [
          {
            attrs: [{ kind: "static", name: "class", value: "vow-radio__dot" }],
            children: [],
            kind: "element",
            tag: "span",
          },
          {
            attrs: [{ kind: "static", name: "class", value: "vow-radio__label" }],
            children: [{ expr: "option", kind: "interp" }],
            kind: "element",
            tag: "span",
          },
        ],
        for: { as: "option", each: "options", key: "option" },
        kind: "element",
        tag: "button",
      },
    ],
    kind: "element",
    tag: "div",
  },
});
