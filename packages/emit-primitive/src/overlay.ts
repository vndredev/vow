import { primitive } from "./define.ts";

/**
 * The overlay adapters over `@vow/headless` — dialog and select. Both layer content above the page and
 * carry the document-touching glue the core leaves to the host (focus moves, body-scroll lock, outside
 * pointer, scroll-into-view). The ARIA contract + keyboard live in the core; the adapter binds the
 * framework's reactivity and spreads the core's props, carrying only `class` + the `data-*` state hooks.
 */

/**
 * Generate the Vue dialog (modal) adapter: a Teleported, v-if'd overlay + content. The ARIA contract,
 * Escape and the Tab focus-trap come from the core; the `setup` glue reacts to the open state — moving
 * focus into the content on open, restoring it on close, and locking body scroll (the document parts).
 */
export const emitDialogSfc = primitive({
  doc: [
    "Generated dialog adapter over @vow/headless. Logic + a11y live in the core — do not edit.",
    "Carries class + data-* hooks only; vow's base look lives in @vow/theme (swappable).",
  ],
  events: [{ name: "update:modelValue", payload: "boolean" }],
  imports: [
    { from: "vue", names: ["computed", "nextTick", "ref", "useId", "watch"] },
    { from: "@vow/headless", names: ["dialog"] },
  ],
  name: "Dialog",
  props: [
    { name: "modelValue", tsType: "boolean" },
    { name: "title", tsType: "string" },
  ],
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
    attrs: [{ kind: "static", name: "to", value: "body" }],
    children: [
      {
        attrs: [
          { expr: "api.open", kind: "cond", type: "if" },
          { kind: "static", name: "class", value: "vow-dialog" },
        ],
        children: [
          {
            attrs: [
              { expr: "api.overlayProps", kind: "spread" },
              { kind: "static", name: "class", value: "vow-dialog__overlay" },
            ],
            children: [],
            kind: "element",
            tag: "div",
          },
          {
            attrs: [
              { expr: "api.contentProps", kind: "spread" },
              { kind: "static", name: "ref", value: "content" },
              { kind: "static", name: "class", value: "vow-dialog__content" },
            ],
            children: [
              {
                attrs: [
                  { expr: "api.titleProps", kind: "spread" },
                  { kind: "static", name: "class", value: "vow-dialog__title" },
                ],
                children: [{ expr: "title", kind: "interp" }],
                kind: "element",
                tag: "h2",
              },
              { children: [], kind: "slot" },
              {
                attrs: [
                  { expr: "api.closeProps", kind: "spread" },
                  { kind: "static", name: "class", value: "vow-dialog__close" },
                ],
                children: [{ kind: "text", text: "×" }],
                kind: "element",
                tag: "button",
              },
            ],
            kind: "element",
            tag: "div",
          },
        ],
        kind: "element",
        tag: "div",
      },
    ],
    kind: "component",
    name: "Teleport",
  },
});

/**
 * Generate the Vue select (listbox) adapter: a combobox trigger + a v-if'd listbox of options. Keyboard
 * + the ARIA contract come from the core; the `setup` glue closes on an outside pointer and scrolls the
 * active option into view (the document parts). A `label` names the combobox (combobox roles take their
 * name from a label, not their contents).
 */
export const emitSelectSfc = primitive({
  doc: [
    "Generated select adapter over @vow/headless. Logic + a11y live in the core — do not edit.",
    "Carries class + data-* hooks only; vow's base look lives in @vow/theme (swappable).",
  ],
  events: [{ name: "update:modelValue", payload: "string" }],
  imports: [
    {
      from: "vue",
      names: ["computed", "nextTick", "onBeforeUnmount", "onMounted", "ref", "useId", "watch"],
    },
    { from: "@vow/headless", names: ["select"] },
  ],
  name: "Select",
  props: [
    { default: '""', name: "modelValue", optional: true, tsType: "string" },
    { name: "options", tsType: "{ value: string; label: string }[]" },
    { name: "label", tsType: "string" },
    { name: "disabled", optional: true, tsType: "boolean" },
  ],
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
    attrs: [
      { expr: "api.rootProps", kind: "spread" },
      { kind: "static", name: "ref", value: "root" },
      { kind: "static", name: "class", value: "vow-select" },
    ],
    children: [
      {
        attrs: [
          { expr: "api.triggerProps", kind: "spread" },
          { expr: "label", kind: "bound", name: "aria-label" },
          { kind: "static", name: "class", value: "vow-select__trigger" },
        ],
        children: [{ expr: "api.selectedLabel", kind: "interp" }],
        kind: "element",
        tag: "button",
      },
      {
        attrs: [
          { expr: "api.listboxProps", kind: "spread" },
          { expr: "api.open", kind: "cond", type: "if" },
          { kind: "static", name: "class", value: "vow-select__listbox" },
        ],
        children: [
          {
            attrs: [
              { expr: "api.optionProps(option)", kind: "spread" },
              { kind: "static", name: "class", value: "vow-select__option" },
            ],
            children: [{ expr: "option.label", kind: "interp" }],
            for: { as: "option", each: "options", key: "option.value" },
            kind: "element",
            tag: "li",
          },
        ],
        kind: "element",
        tag: "ul",
      },
    ],
    kind: "element",
    tag: "div",
  },
});
