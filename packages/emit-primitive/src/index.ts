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
    { name: "modelValue", tsType: "boolean", optional: true, default: "false" },
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

/** The tabs adapter as a canonical Component: a roving tablist + v-show panels with per-item slots. */
const tabs: Component = {
  name: "Tabs",
  doc: [
    "Generated tabs adapter over @vow/headless. Logic + a11y live in the core — do not edit.",
    "Carries class + data-* hooks only; vow's base look lives in @vow/theme (swappable).",
  ],
  imports: [
    { from: "vue", names: ["computed", "useId"] },
    { from: "@vow/headless", names: ["tabs"] },
  ],
  props: [
    { name: "modelValue", tsType: "string" },
    { name: "items", tsType: "string[]" },
  ],
  events: [{ name: "update:modelValue", payload: "string" }],
  setup: [
    "const uid = useId();",
    "const api = computed(() =>",
    "  tabs({ value: props.modelValue, items: props.items, id: uid }, (next) =>",
    '    emit("update:modelValue", next.value),',
    "  ),",
    ");",
  ],
  view: {
    kind: "element",
    tag: "div",
    attrs: [
      { kind: "spread", expr: "api.rootProps" },
      { kind: "static", name: "class", value: "vow-tabs" },
    ],
    children: [
      {
        kind: "element",
        tag: "div",
        attrs: [
          { kind: "spread", expr: "api.listProps" },
          { kind: "static", name: "class", value: "vow-tabs__list" },
        ],
        children: [
          {
            kind: "element",
            tag: "button",
            attrs: [
              { kind: "spread", expr: "api.tabProps(item)" },
              { kind: "static", name: "class", value: "vow-tabs__tab" },
            ],
            for: { each: "items", as: "item", key: "item" },
            children: [{ kind: "interp", expr: "item" }],
          },
        ],
      },
      {
        kind: "element",
        tag: "div",
        attrs: [
          { kind: "spread", expr: "api.panelProps(item)" },
          { kind: "cond", type: "show", expr: "item === modelValue" },
          { kind: "static", name: "class", value: "vow-tabs__panel" },
        ],
        for: { each: "items", as: "item", key: "item" },
        children: [{ kind: "slot", nameExpr: "item", children: [] }],
      },
    ],
  },
};

/** Generate the Vue tabs adapter (over @vow/headless), rendered from the canonical model. */
export function emitTabsSfc(): string {
  return renderVueSfc(tabs);
}

/**
 * The dialog (modal) adapter: a Teleported, v-if'd overlay + content. The ARIA contract, Escape and
 * the Tab focus-trap come from the core; the `setup` glue reacts to the open state — moving focus into
 * the content on open, restoring it on close, and locking body scroll (the parts that touch document).
 */
const dialogComponent: Component = {
  name: "Dialog",
  doc: [
    "Generated dialog adapter over @vow/headless. Logic + a11y live in the core — do not edit.",
    "Carries class + data-* hooks only; vow's base look lives in @vow/theme (swappable).",
  ],
  imports: [
    { from: "vue", names: ["computed", "nextTick", "ref", "useId", "watch"] },
    { from: "@vow/headless", names: ["dialog"] },
  ],
  props: [
    { name: "modelValue", tsType: "boolean" },
    { name: "title", tsType: "string" },
  ],
  events: [{ name: "update:modelValue", payload: "boolean" }],
  setup: [
    "const uid = useId();",
    "const content = ref<HTMLElement>();",
    "let restore: HTMLElement | null = null;",
    "const api = computed(() =>",
    "  dialog({ open: props.modelValue, id: uid }, (next) =>",
    '    emit("update:modelValue", next.open),',
    "  ),",
    ");",
    "watch(",
    "  () => props.modelValue,",
    "  async (open) => {",
    "    if (open) {",
    "      restore = document.activeElement as HTMLElement | null;",
    '      document.body.style.overflow = "hidden";',
    "      await nextTick();",
    "      content.value?.focus();",
    "    } else {",
    '      document.body.style.overflow = "";',
    "      restore?.focus();",
    "    }",
    "  },",
    ");",
  ],
  view: {
    kind: "component",
    name: "Teleport",
    attrs: [{ kind: "static", name: "to", value: "body" }],
    children: [
      {
        kind: "element",
        tag: "div",
        attrs: [
          { kind: "cond", type: "if", expr: "api.open" },
          { kind: "static", name: "class", value: "vow-dialog" },
        ],
        children: [
          {
            kind: "element",
            tag: "div",
            attrs: [
              { kind: "spread", expr: "api.overlayProps" },
              { kind: "static", name: "class", value: "vow-dialog__overlay" },
            ],
            children: [],
          },
          {
            kind: "element",
            tag: "div",
            attrs: [
              { kind: "spread", expr: "api.contentProps" },
              { kind: "static", name: "ref", value: "content" },
              { kind: "static", name: "class", value: "vow-dialog__content" },
            ],
            children: [
              {
                kind: "element",
                tag: "h2",
                attrs: [
                  { kind: "spread", expr: "api.titleProps" },
                  { kind: "static", name: "class", value: "vow-dialog__title" },
                ],
                children: [{ kind: "interp", expr: "title" }],
              },
              { kind: "slot", children: [] },
              {
                kind: "element",
                tag: "button",
                attrs: [
                  { kind: "spread", expr: "api.closeProps" },
                  { kind: "static", name: "class", value: "vow-dialog__close" },
                ],
                children: [{ kind: "text", text: "×" }],
              },
            ],
          },
        ],
      },
    ],
  },
};

/** Generate the Vue dialog adapter (over @vow/headless), rendered from the canonical model. */
export function emitDialogSfc(): string {
  return renderVueSfc(dialogComponent);
}

/**
 * The select (listbox) adapter: a combobox trigger + a v-if'd listbox of options. Keyboard + the ARIA
 * contract come from the core; the `setup` glue closes on an outside pointer and scrolls the active
 * option into view (the parts that touch document). A `label` names the combobox (combobox roles take
 * their name from a label, not their contents).
 */
const selectComponent: Component = {
  name: "Select",
  doc: [
    "Generated select adapter over @vow/headless. Logic + a11y live in the core — do not edit.",
    "Carries class + data-* hooks only; vow's base look lives in @vow/theme (swappable).",
  ],
  imports: [
    {
      from: "vue",
      names: ["computed", "nextTick", "onBeforeUnmount", "onMounted", "ref", "useId", "watch"],
    },
    { from: "@vow/headless", names: ["select"] },
  ],
  props: [
    { name: "modelValue", tsType: "string", optional: true, default: '""' },
    { name: "options", tsType: "{ value: string; label: string }[]" },
    { name: "label", tsType: "string" },
    { name: "disabled", tsType: "boolean", optional: true },
  ],
  events: [{ name: "update:modelValue", payload: "string" }],
  setup: [
    "const uid = useId();",
    "const open = ref(false);",
    "const active = ref(props.modelValue);",
    "const root = ref<HTMLElement>();",
    "const api = computed(() =>",
    "  select(",
    "    {",
    "      value: props.modelValue,",
    "      options: props.options,",
    "      open: open.value,",
    "      active: active.value,",
    "      id: uid,",
    "      disabled: props.disabled,",
    "    },",
    "    (next) => {",
    '      if (next.value !== props.modelValue) emit("update:modelValue", next.value);',
    "      open.value = next.open;",
    "      active.value = next.active;",
    "    },",
    "  ),",
    ");",
    "function onPointer(event: MouseEvent): void {",
    "  if (open.value && root.value && !root.value.contains(event.target as Node)) {",
    "    open.value = false;",
    "  }",
    "}",
    "watch(active, async () => {",
    "  if (!open.value) return;",
    "  await nextTick();",
    '  root.value?.querySelector("[data-active]")?.scrollIntoView({ block: "nearest" });',
    "});",
    'onMounted(() => document.addEventListener("pointerdown", onPointer));',
    'onBeforeUnmount(() => document.removeEventListener("pointerdown", onPointer));',
  ],
  view: {
    kind: "element",
    tag: "div",
    attrs: [
      { kind: "spread", expr: "api.rootProps" },
      { kind: "static", name: "ref", value: "root" },
      { kind: "static", name: "class", value: "vow-select" },
    ],
    children: [
      {
        kind: "element",
        tag: "button",
        attrs: [
          { kind: "spread", expr: "api.triggerProps" },
          { kind: "bound", name: "aria-label", expr: "label" },
          { kind: "static", name: "class", value: "vow-select__trigger" },
        ],
        children: [{ kind: "interp", expr: "api.selectedLabel" }],
      },
      {
        kind: "element",
        tag: "ul",
        attrs: [
          { kind: "spread", expr: "api.listboxProps" },
          { kind: "cond", type: "if", expr: "api.open" },
          { kind: "static", name: "class", value: "vow-select__listbox" },
        ],
        children: [
          {
            kind: "element",
            tag: "li",
            attrs: [
              { kind: "spread", expr: "api.optionProps(option)" },
              { kind: "static", name: "class", value: "vow-select__option" },
            ],
            for: { each: "options", as: "option", key: "option.value" },
            children: [{ kind: "interp", expr: "option.label" }],
          },
        ],
      },
    ],
  },
};

/** Generate the Vue select adapter (over @vow/headless), rendered from the canonical model. */
export function emitSelectSfc(): string {
  return renderVueSfc(selectComponent);
}

/**
 * The button adapter — the ONE structural control with no `@vow/headless` core: `<button>` is already
 * accessible, so there's no a11y logic to prove. It exists only for the variant/size theme surface,
 * carried as `data-variant`/`data-size` hooks the theme styles (no class strings to merge). A default
 * slot holds the content, falling back to the `label` prop for the common spec-driven case.
 */
const button: Component = {
  name: "Button",
  doc: [
    "Generated button — the one structural control with NO headless core (<button> is accessible).",
    "Carries only the variant/size theme surface; vow's base look lives in @vow/theme (swappable).",
  ],
  props: [
    { name: "label", tsType: "string", optional: true, default: "''" },
    {
      name: "variant",
      tsType: "'default' | 'outline' | 'ghost'",
      optional: true,
      default: "'default'",
    },
    { name: "size", tsType: "'sm' | 'md' | 'lg'", optional: true, default: "'md'" },
    { name: "type", tsType: "'button' | 'submit'", optional: true, default: "'button'" },
  ],
  view: {
    kind: "element",
    tag: "button",
    attrs: [
      { kind: "static", name: "class", value: "vow-button" },
      { kind: "bound", name: "type", expr: "type" },
      { kind: "bound", name: "data-variant", expr: "variant" },
      { kind: "bound", name: "data-size", expr: "size" },
    ],
    children: [{ kind: "slot", children: [{ kind: "interp", expr: "label" }] }],
  },
};

/** Generate the Vue button adapter (structural — no headless), rendered from the canonical model. */
export function emitButtonSfc(): string {
  return renderVueSfc(button);
}

/**
 * The field adapter — a structural label + control + optional description and error, with no headless
 * core. The control is the default slot; the caller (a form) owns the id and passes it as `controlId`,
 * so the `<label for>` and the control's `id` line up. The error is a live `role="alert"` region keyed
 * `<controlId>-error`, the target for the control's `aria-describedby`. Look lives in @vow/theme.
 */
const field: Component = {
  name: "Field",
  doc: [
    "Generated field wrapper — a label + control + optional description and error. No headless core:",
    "pure structure + a11y wiring (label `for`, error `role=alert`); the look lives in @vow/theme.",
  ],
  props: [
    { name: "label", tsType: "string" },
    { name: "controlId", tsType: "string" },
    { name: "description", tsType: "string", optional: true },
    { name: "error", tsType: "string", optional: true },
  ],
  view: {
    kind: "element",
    tag: "div",
    attrs: [{ kind: "static", name: "class", value: "vow-field" }],
    children: [
      {
        kind: "element",
        tag: "label",
        attrs: [
          { kind: "static", name: "class", value: "vow-field__label" },
          { kind: "bound", name: "for", expr: "controlId" },
        ],
        children: [{ kind: "interp", expr: "label" }],
      },
      { kind: "slot", children: [] },
      {
        kind: "element",
        tag: "p",
        attrs: [
          { kind: "static", name: "class", value: "vow-field__desc" },
          { kind: "cond", type: "if", expr: "description" },
        ],
        children: [{ kind: "interp", expr: "description" }],
      },
      {
        kind: "element",
        tag: "p",
        attrs: [
          { kind: "static", name: "class", value: "vow-field__error" },
          { kind: "bound", name: "id", expr: "controlId + '-error'" },
          { kind: "static", name: "role", value: "alert" },
          { kind: "cond", type: "if", expr: "error" },
        ],
        children: [{ kind: "interp", expr: "error" }],
      },
    ],
  },
};

/** Generate the Vue field wrapper (structural — no headless), rendered from the canonical model. */
export function emitFieldSfc(): string {
  return renderVueSfc(field);
}

/** The switch (toggle) adapter as a canonical Component: a `<button role=switch>` track + a thumb part. */
const switchComponent: Component = {
  name: "Switch",
  doc: [
    "Generated switch adapter over @vow/headless. Logic + a11y live in the core — do not edit.",
    "Carries class + data-* hooks only; vow's base look lives in @vow/theme (swappable).",
  ],
  imports: [
    { from: "vue", names: ["computed"] },
    { from: "@vow/headless", names: ["switch_"] },
  ],
  props: [
    { name: "modelValue", tsType: "boolean", optional: true, default: "false" },
    { name: "label", tsType: "string" },
    { name: "disabled", tsType: "boolean", optional: true },
  ],
  events: [{ name: "update:modelValue", payload: "boolean" }],
  setup: [
    "const api = computed(() =>",
    "  switch_({ checked: props.modelValue, disabled: props.disabled }, (next) =>",
    '    emit("update:modelValue", next.checked),',
    "  ),",
    ");",
  ],
  view: {
    kind: "element",
    tag: "span",
    attrs: [
      { kind: "spread", expr: "api.rootProps" },
      { kind: "static", name: "class", value: "vow-switch" },
    ],
    children: [
      {
        kind: "element",
        tag: "button",
        attrs: [
          { kind: "spread", expr: "api.controlProps" },
          { kind: "bound", name: "aria-label", expr: "label" },
          { kind: "static", name: "class", value: "vow-switch__control" },
        ],
        children: [
          {
            kind: "element",
            tag: "span",
            attrs: [
              { kind: "spread", expr: "api.thumbProps" },
              { kind: "static", name: "class", value: "vow-switch__thumb" },
            ],
            children: [],
          },
        ],
      },
      {
        kind: "element",
        tag: "span",
        attrs: [
          { kind: "spread", expr: "api.labelProps" },
          { kind: "static", name: "class", value: "vow-switch__label" },
        ],
        children: [{ kind: "interp", expr: "label" }],
      },
    ],
  },
};

/** Generate the Vue switch adapter (over @vow/headless), rendered from the canonical model. */
export function emitSwitchSfc(): string {
  return renderVueSfc(switchComponent);
}

/** The radio-group adapter as a canonical Component: a `role=radiogroup` of `role=radio` buttons. */
const radioGroupComponent: Component = {
  name: "RadioGroup",
  doc: [
    "Generated radio-group adapter over @vow/headless. Logic + a11y live in the core — do not edit.",
    "Carries class + data-* hooks only; vow's base look lives in @vow/theme (swappable).",
  ],
  imports: [
    { from: "vue", names: ["computed"] },
    { from: "@vow/headless", names: ["radioGroup"] },
  ],
  props: [
    { name: "modelValue", tsType: "string", optional: true, default: '""' },
    { name: "options", tsType: "string[]" },
    { name: "label", tsType: "string" },
    { name: "disabled", tsType: "boolean", optional: true },
  ],
  events: [{ name: "update:modelValue", payload: "string" }],
  setup: [
    "const api = computed(() =>",
    "  radioGroup({ value: props.modelValue, options: props.options, disabled: props.disabled }, (next) =>",
    '    emit("update:modelValue", next.value),',
    "  ),",
    ");",
  ],
  view: {
    kind: "element",
    tag: "div",
    attrs: [
      { kind: "spread", expr: "api.rootProps" },
      { kind: "bound", name: "aria-label", expr: "label" },
      { kind: "static", name: "class", value: "vow-radio" },
    ],
    children: [
      {
        kind: "element",
        tag: "button",
        attrs: [
          { kind: "spread", expr: "api.radioProps(option)" },
          { kind: "static", name: "class", value: "vow-radio__option" },
        ],
        for: { each: "options", as: "option", key: "option" },
        children: [
          {
            kind: "element",
            tag: "span",
            attrs: [{ kind: "static", name: "class", value: "vow-radio__dot" }],
            children: [],
          },
          {
            kind: "element",
            tag: "span",
            attrs: [{ kind: "static", name: "class", value: "vow-radio__label" }],
            children: [{ kind: "interp", expr: "option" }],
          },
        ],
      },
    ],
  },
};

/** Generate the Vue radio-group adapter (over @vow/headless), rendered from the canonical model. */
export function emitRadioGroupSfc(): string {
  return renderVueSfc(radioGroupComponent);
}

/**
 * The closed primitive registry — PascalCase name → its Vue SFC emitter. The single source of vow's
 * primitive vocabulary: `emit-view` validates `## view` references against these names, the vite-plugin
 * materialises each referenced adapter into `.generated/` on demand, and the docs reuse it for prose.
 */
export const PRIMITIVE_ADAPTERS: Record<string, () => string> = {
  Button: emitButtonSfc,
  Checkbox: emitCheckboxSfc,
  Collapsible: emitCollapsibleSfc,
  Dialog: emitDialogSfc,
  Field: emitFieldSfc,
  RadioGroup: emitRadioGroupSfc,
  Select: emitSelectSfc,
  Switch: emitSwitchSfc,
  Tabs: emitTabsSfc,
};
