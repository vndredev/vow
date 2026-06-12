import {
  emitCheckboxSfc,
  emitCollapsibleSfc,
  emitDialogSfc,
  emitRadioGroupSfc,
  emitSelectSfc,
  emitSwitchSfc,
  emitTabsSfc,
} from "../src/index.ts";
import { expect, test } from "vite-plus/test";

test("emitCheckboxSfc binds the agnostic headless core (logic + a11y live there)", () => {
  const sfc = emitCheckboxSfc();
  expect(sfc).toContain('import { checkbox } from "@vow/headless";');
  expect(sfc).toContain(
    "withDefaults(defineProps<{ modelValue?: boolean; label: string; disabled?: boolean }>(), { modelValue: false })",
  );
  expect(sfc).toContain('emit("update:modelValue", next.checked)');
});

test("emitCheckboxSfc emits a Reka-style control + indicator with class + data hooks, no styling", () => {
  const sfc = emitCheckboxSfc();
  // A <button role=checkbox> control wrapping an indicator part; spreads the core's props.
  expect(sfc).toContain("<button ");
  expect(sfc).toContain('v-bind="api.controlProps"');
  expect(sfc).toContain('v-bind="api.indicatorProps"');
  expect(sfc).toContain('class="vow-checkbox"');
  expect(sfc).toContain('class="vow-checkbox__control"');
  expect(sfc).toContain('class="vow-checkbox__indicator"');
  expect(sfc).toContain(':aria-label="label"');
  // Carries no styling of its own — vow's base look lives in @vow/theme (swappable).
  expect(sfc).not.toContain("<style");
});

// The byte-stable oracle for the collapsible adapter: a button trigger + a v-show content region.
// Pins the exact emitted SFC — a render change is a red test, not silent drift.
const EXPECTED_COLLAPSIBLE = [
  `<script setup lang="ts">`,
  `// Generated collapsible adapter over @vow/headless. Logic + a11y live in the core — do not edit.`,
  `// Carries class + data-* hooks only; vow's base look lives in @vow/theme (swappable).`,
  `import { computed, useId } from "vue";`,
  `import { collapsible } from "@vow/headless";`,
  ``,
  `const props = defineProps<{ modelValue: boolean; label: string; disabled?: boolean }>();`,
  `const emit = defineEmits<{ "update:modelValue": [boolean] }>();`,
  ``,
  `const uid = useId();`,
  `const api = computed(() =>`,
  `  collapsible({ open: props.modelValue, id: uid, disabled: props.disabled }, (next) =>`,
  `    emit("update:modelValue", next.open),`,
  `  ),`,
  `);`,
  `</script>`,
  ``,
  `<template>`,
  `  <div v-bind="api.rootProps" class="vow-collapsible">`,
  `    <button v-bind="api.triggerProps" class="vow-collapsible__trigger">{{ label }}</button>`,
  `    <div v-bind="api.contentProps" v-show="api.open" class="vow-collapsible__content">`,
  `      <slot />`,
  `    </div>`,
  `  </div>`,
  `</template>`,
  ``,
].join("\n");

test("emitCollapsibleSfc renders the collapsible adapter byte-for-byte", () => {
  expect(emitCollapsibleSfc()).toBe(EXPECTED_COLLAPSIBLE);
});

// The byte-stable oracle for the tabs adapter: a roving tablist + v-show panels with per-item slots.
const EXPECTED_TABS = [
  `<script setup lang="ts">`,
  `// Generated tabs adapter over @vow/headless. Logic + a11y live in the core — do not edit.`,
  `// Carries class + data-* hooks only; vow's base look lives in @vow/theme (swappable).`,
  `import { computed, useId } from "vue";`,
  `import { tabs } from "@vow/headless";`,
  ``,
  `const props = defineProps<{ modelValue: string; items: string[] }>();`,
  `const emit = defineEmits<{ "update:modelValue": [string] }>();`,
  ``,
  `const uid = useId();`,
  `const api = computed(() =>`,
  `  tabs({ value: props.modelValue, items: props.items, id: uid }, (next) =>`,
  `    emit("update:modelValue", next.value),`,
  `  ),`,
  `);`,
  `</script>`,
  ``,
  `<template>`,
  `  <div v-bind="api.rootProps" class="vow-tabs">`,
  `    <div v-bind="api.listProps" class="vow-tabs__list">`,
  `      <button v-bind="api.tabProps(item)" class="vow-tabs__tab" v-for="item in items" :key="item">{{ item }}</button>`,
  `    </div>`,
  `    <div v-bind="api.panelProps(item)" v-show="item === modelValue" class="vow-tabs__panel" v-for="item in items" :key="item">`,
  `      <slot :name="item" />`,
  `    </div>`,
  `  </div>`,
  `</template>`,
  ``,
].join("\n");

test("emitTabsSfc renders the tabs adapter byte-for-byte", () => {
  expect(emitTabsSfc()).toBe(EXPECTED_TABS);
});

// The byte-stable oracle for the dialog adapter: a Teleported, v-if'd overlay + content.
const EXPECTED_DIALOG = [
  `<script setup lang="ts">`,
  `// Generated dialog adapter over @vow/headless. Logic + a11y live in the core — do not edit.`,
  `// Carries class + data-* hooks only; vow's base look lives in @vow/theme (swappable).`,
  `import { computed, nextTick, ref, useId, watch } from "vue";`,
  `import { dialog } from "@vow/headless";`,
  ``,
  `const props = defineProps<{ modelValue: boolean; title: string }>();`,
  `const emit = defineEmits<{ "update:modelValue": [boolean] }>();`,
  ``,
  `const uid = useId();`,
  `const content = ref<HTMLElement>();`,
  `let restore: HTMLElement | null = null;`,
  `const api = computed(() =>`,
  `  dialog({ open: props.modelValue, id: uid }, (next) =>`,
  `    emit("update:modelValue", next.open),`,
  `  ),`,
  `);`,
  `watch(`,
  `  () => props.modelValue,`,
  `  async (open) => {`,
  `    if (open) {`,
  `      restore = document.activeElement as HTMLElement | null;`,
  `      document.body.style.overflow = "hidden";`,
  `      await nextTick();`,
  `      content.value?.focus();`,
  `    } else {`,
  `      document.body.style.overflow = "";`,
  `      restore?.focus();`,
  `    }`,
  `  },`,
  `);`,
  `</script>`,
  ``,
  `<template>`,
  `  <Teleport to="body">`,
  `    <div v-if="api.open" class="vow-dialog">`,
  `      <div v-bind="api.overlayProps" class="vow-dialog__overlay" />`,
  `      <div v-bind="api.contentProps" ref="content" class="vow-dialog__content">`,
  `        <h2 v-bind="api.titleProps" class="vow-dialog__title">{{ title }}</h2>`,
  `        <slot />`,
  `        <button v-bind="api.closeProps" class="vow-dialog__close">×</button>`,
  `      </div>`,
  `    </div>`,
  `  </Teleport>`,
  `</template>`,
  ``,
].join("\n");

test("emitDialogSfc renders the dialog adapter byte-for-byte", () => {
  expect(emitDialogSfc()).toBe(EXPECTED_DIALOG);
});

// The byte-stable oracle for the select adapter: a combobox trigger + a v-if'd listbox of options.
const EXPECTED_SELECT = [
  `<script setup lang="ts">`,
  `// Generated select adapter over @vow/headless. Logic + a11y live in the core — do not edit.`,
  `// Carries class + data-* hooks only; vow's base look lives in @vow/theme (swappable).`,
  `import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from "vue";`,
  `import { select } from "@vow/headless";`,
  ``,
  `const props = withDefaults(defineProps<{ modelValue?: string; options: { value: string; label: string }[]; label: string; controlId?: string; describedBy?: string; invalid?: boolean; disabled?: boolean }>(), { modelValue: "" });`,
  `const emit = defineEmits<{ "update:modelValue": [string] }>();`,
  ``,
  `const uid = useId();`,
  `const open = ref(false);`,
  `const active = ref(props.modelValue);`,
  `const root = ref<HTMLElement>();`,
  `const api = computed(() =>`,
  `  select(`,
  `    {`,
  `      value: props.modelValue,`,
  `      options: props.options,`,
  `      open: open.value,`,
  `      active: active.value,`,
  `      id: uid,`,
  `      triggerId: props.controlId,`,
  `      disabled: props.disabled,`,
  `    },`,
  `    (next) => {`,
  `      if (next.value !== props.modelValue) emit("update:modelValue", next.value);`,
  `      open.value = next.open;`,
  `      active.value = next.active;`,
  `    },`,
  `  ),`,
  `);`,
  `function onPointer(event: MouseEvent): void {`,
  `  if (open.value && root.value && !root.value.contains(event.target as Node)) {`,
  `    open.value = false;`,
  `  }`,
  `}`,
  `watch(active, async () => {`,
  `  if (!open.value) return;`,
  `  await nextTick();`,
  `  root.value?.querySelector("[data-active]")?.scrollIntoView({ block: "nearest" });`,
  `});`,
  `onMounted(() => document.addEventListener("pointerdown", onPointer));`,
  `onBeforeUnmount(() => document.removeEventListener("pointerdown", onPointer));`,
  `</script>`,
  ``,
  `<template>`,
  `  <div v-bind="api.rootProps" ref="root" class="vow-select">`,
  `    <button v-bind="api.triggerProps" :aria-label="label" :aria-describedby="describedBy" :aria-invalid="invalid" class="vow-select__trigger">{{ api.selectedLabel }}</button>`,
  `    <ul v-bind="api.listboxProps" v-if="api.open" class="vow-select__listbox">`,
  `      <li v-bind="api.optionProps(option)" class="vow-select__option" v-for="option in options" :key="option.value">{{ option.label }}</li>`,
  `    </ul>`,
  `  </div>`,
  `</template>`,
  ``,
].join("\n");

test("emitSelectSfc renders the select adapter byte-for-byte", () => {
  expect(emitSelectSfc()).toBe(EXPECTED_SELECT);
});

// The byte-stable oracle for the switch adapter: a <button role=switch> track + a thumb part.
const EXPECTED_SWITCH = [
  `<script setup lang="ts">`,
  `// Generated switch adapter over @vow/headless. Logic + a11y live in the core — do not edit.`,
  `// Carries class + data-* hooks only; vow's base look lives in @vow/theme (swappable).`,
  `import { computed } from "vue";`,
  `import { switch_ } from "@vow/headless";`,
  ``,
  `const props = withDefaults(defineProps<{ modelValue?: boolean; label: string; disabled?: boolean }>(), { modelValue: false });`,
  `const emit = defineEmits<{ "update:modelValue": [boolean] }>();`,
  ``,
  `const api = computed(() =>`,
  `  switch_({ checked: props.modelValue, disabled: props.disabled }, (next) =>`,
  `    emit("update:modelValue", next.checked),`,
  `  ),`,
  `);`,
  `</script>`,
  ``,
  `<template>`,
  `  <span v-bind="api.rootProps" class="vow-switch">`,
  `    <button v-bind="api.controlProps" :aria-label="label" class="vow-switch__control">`,
  `      <span v-bind="api.thumbProps" class="vow-switch__thumb" />`,
  `    </button>`,
  `    <span v-bind="api.labelProps" class="vow-switch__label">{{ label }}</span>`,
  `  </span>`,
  `</template>`,
  ``,
].join("\n");

test("emitSwitchSfc renders the switch adapter byte-for-byte", () => {
  expect(emitSwitchSfc()).toBe(EXPECTED_SWITCH);
});

// The byte-stable oracle for the radio-group adapter: a role=radiogroup of role=radio buttons.
const EXPECTED_RADIO = [
  `<script setup lang="ts">`,
  `// Generated radio-group adapter over @vow/headless. Logic + a11y live in the core — do not edit.`,
  `// Carries class + data-* hooks only; vow's base look lives in @vow/theme (swappable).`,
  `import { computed } from "vue";`,
  `import { radioGroup } from "@vow/headless";`,
  ``,
  `const props = withDefaults(defineProps<{ modelValue?: string; options: string[]; label: string; disabled?: boolean }>(), { modelValue: "" });`,
  `const emit = defineEmits<{ "update:modelValue": [string] }>();`,
  ``,
  `const api = computed(() =>`,
  `  radioGroup({ value: props.modelValue, options: props.options, disabled: props.disabled }, (next) =>`,
  `    emit("update:modelValue", next.value),`,
  `  ),`,
  `);`,
  `</script>`,
  ``,
  `<template>`,
  `  <div v-bind="api.rootProps" :aria-label="label" class="vow-radio">`,
  `    <button v-bind="api.radioProps(option)" class="vow-radio__option" v-for="option in options" :key="option">`,
  `      <span class="vow-radio__dot" />`,
  `      <span class="vow-radio__label">{{ option }}</span>`,
  `    </button>`,
  `  </div>`,
  `</template>`,
  ``,
].join("\n");

test("emitRadioGroupSfc renders the radio-group adapter byte-for-byte", () => {
  expect(emitRadioGroupSfc()).toBe(EXPECTED_RADIO);
});
