<script setup lang="ts">
import { computed, ref } from "vue";
import { collapsible } from "@vow/headless";
import type { SidebarGroup } from "../src/sidebar.ts";

// One sidebar group — a Collapsible (dogfooding @vow/headless) over its links. Open by default.
const props = defineProps<{ group: SidebarGroup; currentPath: string }>();
const open = ref(true);
const api = computed(() =>
  collapsible({ open: open.value, id: `sb-${props.group.text}` }, (next) => {
    open.value = next.open;
  }),
);
</script>

<template>
  <div class="vow-sidebar__group">
    <button v-bind="api.triggerProps" class="vow-sidebar__heading">{{ group.text }}</button>
    <ul v-bind="api.contentProps" v-show="open" class="vow-sidebar__items">
      <li v-for="item in group.items" :key="item.link">
        <a
          :href="item.link"
          class="vow-sidebar__link"
          :class="{ 'is-active': item.link === currentPath }"
          >{{ item.text }}</a
        >
        <ul v-if="item.items && item.items.length > 0" class="vow-sidebar__sub">
          <li v-for="sub in item.items" :key="sub.link">
            <a
              :href="sub.link"
              class="vow-sidebar__link"
              :class="{ 'is-active': sub.link === currentPath }"
              >{{ sub.text }}</a
            >
          </li>
        </ul>
      </li>
    </ul>
  </div>
</template>
