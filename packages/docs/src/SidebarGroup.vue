<script setup lang="ts">
import { collapsible } from "@vow/headless";
import { computed, ref } from "vue";
import type { SidebarGroup } from "./index.ts";

// One sidebar section — a Collapsible (vow's own primitive) over its links. Open by default.
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
    <button v-bind="api.triggerProps" class="vow-sidebar__heading">{{ group.title }}</button>
    <ul v-bind="api.contentProps" v-show="open" class="vow-sidebar__items">
      <li v-for="item in group.items" :key="item.path">
        <a
          :href="item.path"
          class="vow-sidebar__link"
          :class="{ 'is-active': item.path === path }"
          :aria-current="item.path === path ? 'page' : undefined"
          >{{ item.title }}</a
        >
        <ul v-if="item.items && item.items.length > 0" class="vow-sidebar__items vow-sidebar__sub">
          <li v-for="sub in item.items" :key="sub.path">
            <a
              :href="sub.path"
              class="vow-sidebar__link"
              :class="{ 'is-active': sub.path === path }"
              :aria-current="sub.path === path ? 'page' : undefined"
              >{{ sub.title }}</a
            >
          </li>
        </ul>
      </li>
    </ul>
  </div>
</template>
