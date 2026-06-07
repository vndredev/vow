<script setup lang="ts">
import { computed, ref, useId } from "vue";
import { tabs } from "@vow/headless";

// Code-group / tablist for the docs — built on vow's own `tabs()` primitive (dogfood). Panels are named
// slots keyed by the tab label, so `::: code-group` fills them with dynamic slots.
const props = defineProps<{ items: string[] }>();
const uid = useId();
const selected = ref(props.items[0] ?? "");
const api = computed(() =>
  tabs({ value: selected.value, items: props.items, id: uid }, (next) => {
    selected.value = next.value;
  }),
);
</script>

<template>
  <div v-bind="api.rootProps" class="vow-tabs">
    <div v-bind="api.listProps" class="vow-tabs__list">
      <button v-for="item in items" :key="item" v-bind="api.tabProps(item)" class="vow-tabs__tab">
        {{ item }}
      </button>
    </div>
    <div
      v-for="item in items"
      :key="item"
      v-bind="api.panelProps(item)"
      v-show="item === selected"
      class="vow-tabs__panel"
    >
      <slot :name="item" />
    </div>
  </div>
</template>
