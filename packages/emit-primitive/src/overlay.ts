import { primitive } from "./define.ts";

/**
 * The overlay adapters over `@vow/headless` — dialog, select and context menu. Each layers content above
 * the page and carries the document-touching glue the core leaves to the host (focus moves, body-scroll
 * lock, outside pointer, scroll-into-view, cursor positioning). The ARIA contract + keyboard live in the
 * core; the adapter binds the framework's reactivity and spreads the core's props, carrying only `class` +
 * the `data-*` state hooks.
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
    { default: '"Select…"', name: "placeholder", optional: true, tsType: "string" },
    { name: "controlId", optional: true, tsType: "string" },
    { name: "describedBy", optional: true, tsType: "string" },
    { name: "invalid", optional: true, tsType: "boolean" },
    { name: "disabled", optional: true, tsType: "boolean" },
  ],
  setup: [
    "const uid = useId();",
    "const open = ref(false);",
    "const active = ref(props.modelValue);",
    'const typed = ref("");',
    "const root = ref<HTMLElement>();",
    "let typeTimer: ReturnType<typeof setTimeout> | undefined;",
    "const api = computed(() =>",
    "  select(",
    "    {",
    "      value: props.modelValue,",
    "      options: props.options,",
    "      open: open.value,",
    "      active: active.value,",
    "      typed: typed.value,",
    "      id: uid,",
    "      triggerId: props.controlId,",
    "      disabled: props.disabled,",
    "    },",
    "    (next) => {",
    '      if (next.value !== props.modelValue) emit("update:modelValue", next.value);',
    "      open.value = next.open;",
    "      active.value = next.active;",
    "      if (next.typed !== typed.value) {",
    '        typed.value = next.typed ?? "";',
    "        clearTimeout(typeTimer);",
    '        typeTimer = setTimeout(() => (typed.value = ""), 500);',
    "      }",
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
          { expr: "describedBy", kind: "bound", name: "aria-describedby" },
          { expr: "invalid", kind: "bound", name: "aria-invalid" },
          { kind: "static", name: "class", value: "vow-select__trigger" },
        ],
        children: [{ expr: "api.selectedLabel || placeholder", kind: "interp" }],
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

/**
 * Generate the Vue context-menu adapter: a slot trigger that opens on right-click + a v-if'd `role="menu"`
 * panel positioned at the cursor. Keyboard + the ARIA contract come from the core; the `setup` glue records
 * the cursor, closes on an outside pointer, and moves focus into the panel on open (the document parts). A
 * commit surfaces the chosen item via the core's `chosen`, which the adapter re-emits as `select`.
 */
export const emitContextMenuSfc = primitive({
  doc: [
    "Generated context-menu adapter over @vow/headless. Logic + a11y live in the core — do not edit.",
    "Carries class + data-* hooks only; vow's base look lives in @vow/theme (swappable).",
  ],
  events: [{ name: "select", payload: "string" }],
  imports: [
    {
      from: "vue",
      names: ["computed", "nextTick", "onBeforeUnmount", "onMounted", "ref", "useId", "watch"],
    },
    { from: "@vow/headless", names: ["contextMenu"] },
  ],
  name: "ContextMenu",
  props: [{ name: "items", tsType: "{ value: string; label: string }[]" }],
  setup: [
    "const uid = useId();",
    "const open = ref(false);",
    "const active = ref('');",
    "const x = ref(0);",
    "const y = ref(0);",
    "const root = ref<HTMLElement>();",
    "const panel = ref<HTMLElement>();",
    "const api = computed(() =>",
    "  contextMenu(",
    "    { active: active.value, id: uid, items: props.items, open: open.value },",
    "    (next) => {",
    '      if (next.chosen !== undefined) emit("select", next.chosen);',
    "      open.value = next.open;",
    "      active.value = next.active;",
    "    },",
    "  ),",
    ");",
    "function onContextMenu(event: MouseEvent): void {",
    "  event.preventDefault();",
    "  x.value = event.clientX;",
    "  y.value = event.clientY;",
    "  active.value = props.items[0]?.value ?? '';",
    "  open.value = true;",
    "}",
    "function onPointer(event: MouseEvent): void {",
    "  if (open.value && root.value && !root.value.contains(event.target as Node)) {",
    "    open.value = false;",
    "  }",
    "}",
    "watch(open, async (isOpen) => {",
    "  if (!isOpen) return;",
    "  await nextTick();",
    "  panel.value?.focus();",
    "});",
    'onMounted(() => document.addEventListener("pointerdown", onPointer));',
    'onBeforeUnmount(() => document.removeEventListener("pointerdown", onPointer));',
  ],
  view: {
    attrs: [
      { expr: "api.rootProps", kind: "spread" },
      { kind: "static", name: "ref", value: "root" },
      { kind: "static", name: "class", value: "vow-context-menu" },
    ],
    children: [
      {
        attrs: [
          { expr: "onContextMenu", kind: "event", name: "contextmenu" },
          { kind: "static", name: "class", value: "vow-context-menu__trigger" },
        ],
        children: [{ children: [], kind: "slot" }],
        kind: "element",
        tag: "div",
      },
      {
        attrs: [
          { expr: "api.panelProps", kind: "spread" },
          { kind: "static", name: "ref", value: "panel" },
          { expr: "api.open", kind: "cond", type: "if" },
          { expr: "{ left: x + 'px', top: y + 'px' }", kind: "bound", name: "style" },
          { kind: "static", name: "class", value: "vow-context-menu__panel" },
        ],
        children: [
          {
            attrs: [
              { expr: "api.itemProps(item)", kind: "spread" },
              { kind: "static", name: "class", value: "vow-context-menu__item" },
            ],
            children: [{ expr: "item.label", kind: "interp" }],
            for: { as: "item", each: "items", key: "item.value" },
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
});
