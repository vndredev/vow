<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { select } from "@vow/headless";
import {
  FRAMEWORKS,
  initFramework,
  setFramework,
  useFramework,
  type FrameworkId,
} from "./useFramework.ts";

// The header framework picker — built on vow's own `select()` primitive (dogfood), bound to the shared
// framework state. Planned frameworks are labelled; choosing one drives the FrameworkBlock banners.
const framework = useFramework();
const open = ref(false);
const active = ref<string>(framework.value);
const root = ref<HTMLElement>();

const options = FRAMEWORKS.map((f) => ({
  value: f.id,
  label: f.status === "planned" ? `${f.label} · planned` : f.label,
}));

const api = computed(() =>
  select(
    { value: framework.value, options, open: open.value, active: active.value, id: "fw" },
    (next) => {
      if (next.value !== framework.value) setFramework(next.value as FrameworkId);
      open.value = next.open;
      active.value = next.active;
    },
  ),
);

function onPointer(event: MouseEvent): void {
  if (open.value && root.value && !root.value.contains(event.target as Node)) open.value = false;
}
watch(active, async () => {
  if (!open.value) return;
  await nextTick();
  root.value?.querySelector("[data-active]")?.scrollIntoView({ block: "nearest" });
});
onMounted(() => {
  initFramework();
  active.value = framework.value;
  document.addEventListener("pointerdown", onPointer);
});
onBeforeUnmount(() => document.removeEventListener("pointerdown", onPointer));
</script>

<template>
  <div ref="root" v-bind="api.rootProps" class="vow-select vow-nav__fw">
    <button v-bind="api.triggerProps" aria-label="Target framework" class="vow-select__trigger">
      {{ api.selectedLabel }}
    </button>
    <ul v-if="api.open" v-bind="api.listboxProps" class="vow-select__listbox">
      <li
        v-for="option in options"
        :key="option.value"
        v-bind="api.optionProps(option)"
        class="vow-select__option"
      >
        {{ option.label }}
      </li>
    </ul>
  </div>
</template>
