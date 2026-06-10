<script setup lang="ts">
import { computed, ref } from "vue";
import Icon from "@vow/icons/Icon.vue";
import type { SidebarGroup } from "./index.ts";
import SidebarItem from "./sidebar-item.vue";
import { collapsible } from "@vow/headless";

// One sidebar section — a Collapsible (vow's own primitive) over its entries. Open by default.
const props = defineProps<{ group: SidebarGroup; path: string }>();
const open = ref(true);
const api = computed(() =>
  collapsible({ id: `sb-${props.group.title}`, open: open.value }, (next) => {
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
