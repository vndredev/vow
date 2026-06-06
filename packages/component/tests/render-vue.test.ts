import { expect, test } from "vite-plus/test";
import { renderVueSfc, type Component } from "../src/index.ts";

// The checkbox adapter expressed as a canonical Component. Step 2 will build this same shape
// inside emit-primitive; here it is the proof that renderVueSfc can reproduce the real output.
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

// The byte-exact oracle: today's hand-written emit-primitive output. The migration is only safe if
// renderVueSfc reproduces this character-for-character — indentation, blank lines, glyphs and all.
const EXPECTED_CHECKBOX = [
  `<script setup lang="ts">`,
  `// Generated checkbox adapter over @vow/headless. Logic + a11y live in the core — do not edit.`,
  `// Unstyled: class + data-* hooks only; styling lives in @vow/theme (swappable).`,
  `import { computed } from "vue";`,
  `import { checkbox } from "@vow/headless";`,
  ``,
  `const props = defineProps<{ modelValue: boolean; label: string; disabled?: boolean }>();`,
  `const emit = defineEmits<{ "update:modelValue": [boolean] }>();`,
  ``,
  `const api = computed(() =>`,
  `  checkbox({ checked: props.modelValue, disabled: props.disabled }, (next) =>`,
  `    emit("update:modelValue", next.checked),`,
  `  ),`,
  `);`,
  `</script>`,
  ``,
  `<template>`,
  `  <label v-bind="api.rootProps" class="vow-checkbox">`,
  `    <span v-bind="api.controlProps" :aria-label="label" class="vow-checkbox__box">{{ api.checked ? "✓" : "" }}</span>`,
  `    <span v-bind="api.labelProps" class="vow-checkbox__label">{{ label }}</span>`,
  `  </label>`,
  `</template>`,
  ``,
].join("\n");

test("renderVueSfc reproduces the checkbox SFC byte-for-byte (the migration oracle)", () => {
  expect(renderVueSfc(checkbox)).toBe(EXPECTED_CHECKBOX);
});

test("a literal text node is HTML-escaped (& < > in order)", () => {
  const c: Component = {
    name: "Heading",
    view: {
      kind: "element",
      tag: "h1",
      attrs: [],
      children: [{ kind: "text", text: "a < b & c" }],
    },
  };
  expect(renderVueSfc(c)).toContain("<h1>a &lt; b &amp; c</h1>");
});

test("a void element renders self-closing (<input … />)", () => {
  const c: Component = {
    name: "Field",
    view: {
      kind: "element",
      tag: "input",
      attrs: [
        { kind: "static", name: "class", value: "vow-view__input" },
        { kind: "bound", name: "value", expr: "draft.x" },
      ],
      children: [],
    },
  };
  expect(renderVueSfc(c)).toContain('<input class="vow-view__input" :value="draft.x" />');
});

test("a default import renders as `import X from …`", () => {
  const c: Component = {
    name: "Host",
    imports: [{ from: "./Checkbox.vue", default: "Checkbox" }],
    view: { kind: "element", tag: "div", attrs: [], children: [] },
  };
  expect(renderVueSfc(c)).toContain('import Checkbox from "./Checkbox.vue";');
});
