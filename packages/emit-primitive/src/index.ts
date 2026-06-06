/**
 * vow's primitive emitter — generates the thin framework adapter over a `@vow/headless` primitive.
 *
 * The logic AND the a11y are already proven in the core (tested against the DOM, framework-free).
 * The adapter just binds the framework's reactivity and spreads the props — so this generated code
 * stays trivial and needs no separate a11y test. More primitives (switch, dialog, …) grow from here.
 */

/** Generate the Vue checkbox adapter: binds reactivity, spreads the headless props. */
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
    `    <span v-bind="api.controlProps" :aria-label="label">{{ api.checked ? "✓" : "" }}</span>`,
    `    <span v-bind="api.labelProps">{{ label }}</span>`,
    `  </label>`,
    `</template>`,
    ``,
  ].join("\n");
}
