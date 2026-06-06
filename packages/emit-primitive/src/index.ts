/**
 * vow's primitive emitter — generates the thin framework adapter over a `@vow/headless` primitive.
 *
 * The logic AND the a11y are already proven in the core (tested against the DOM, framework-free).
 * The adapter binds the framework's reactivity, spreads the props, and ships minimal structural
 * styles so the control is usable out of the box (the design system layers on top). More primitives
 * (switch, dialog, …) grow from here.
 */

/** Generate the Vue checkbox adapter: binds reactivity, spreads the headless props, basic styling. */
export function emitCheckboxSfc(): string {
  return [
    `<script setup lang="ts">`,
    `// Generated checkbox adapter over @vow/headless. Logic + a11y live in the core — do not edit.`,
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
    `<style scoped>`,
    `.vow-checkbox {`,
    `  display: inline-flex;`,
    `  align-items: center;`,
    `  gap: 0.4em;`,
    `  cursor: pointer;`,
    `}`,
    `.vow-checkbox__box {`,
    `  display: inline-flex;`,
    `  align-items: center;`,
    `  justify-content: center;`,
    `  width: 1.15em;`,
    `  height: 1.15em;`,
    `  border: 1px solid currentColor;`,
    `  border-radius: 0.2em;`,
    `  font-size: 0.85em;`,
    `  line-height: 1;`,
    `}`,
    `.vow-checkbox__box:focus-visible {`,
    `  outline: 2px solid currentColor;`,
    `  outline-offset: 2px;`,
    `}`,
    `</style>`,
    ``,
  ].join("\n");
}
