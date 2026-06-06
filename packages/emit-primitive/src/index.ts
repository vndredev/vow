/**
 * vow's primitive emitter — generates the thin framework adapter over a `@vow/headless` primitive.
 *
 * The logic AND the a11y are proven in the core (tested against the DOM, framework-free). The adapter
 * binds the framework's reactivity and spreads the props — and is **unstyled**: it only carries
 * `class` + the core's `data-*` hooks. Styling lives in a swappable theme (`@vow/theme`), so the
 * component runs bare (Zag-style) and the design system layers on without touching it.
 */

/** Generate the Vue checkbox adapter: binds reactivity, spreads the headless props, class hooks only. */
export function emitCheckboxSfc(): string {
  return [
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
}
