<script setup lang="ts">
import { collapsible } from "@vow/headless";
import Icon from "@vow/icons/Icon.vue";
import { computed, ref } from "vue";
import type { SidebarGroup } from "./index.ts";
import SidebarItem from "./SidebarItem.vue";

// One sidebar section — a Collapsible (vow's own primitive) over its entries. Open by default.
const props = defineProps<{ group: SidebarGroup; path: string }>();
const open = ref(true);
const api = computed(() =>
  collapsible({ open: open.value, id: `sb-${props.group.title}` }, (next) => {
    open.value = next.open;
  }),
);
</script>

<template>
  <div class="vow-sidebar__group">
    <button v-bind="api.triggerProps" class="vow-sidebar__heading">
      <span>{{ group.title }}</span>
      <Icon name="chevron-down" class="vow-sidebar__caret" />
    </button>
    <ul v-bind="api.contentProps" v-show="open" class="vow-sidebar__items">
      <SidebarItem v-for="item in group.items" :key="item.path" :item="item" :path="path" />
    </ul>
  </div>
</template>
