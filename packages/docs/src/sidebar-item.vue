<script setup lang="ts">
import { computed, ref } from "vue";
import Icon from "@vow/icons/Icon.vue";
import type { SidebarItem } from "./index.ts";
import { collapsible } from "@vow/headless";

// One sidebar entry. A leaf is a link; an entry with children is a link + a Collapsible caret over its
// Nested pages (recursive). Open by default. Dogfoods `collapsible` at the item level.
const props = defineProps<{ item: SidebarItem; path: string }>();
const hasChildren = computed(() => (props.item.items?.length ?? 0) > 0);
const open = ref(true);
const api = computed(() =>
  collapsible({ id: `sb-${props.item.path}`, open: open.value }, (next) => {
    open.value = next.open;
  }),
);
</script>

<template>
  <li>
    <div v-if="hasChildren" class="vow-sidebar__row">
      <a
        :href="item.path"
        class="vow-sidebar__link"
        :class="{ 'is-active': item.path === path }"
        :aria-current="item.path === path ? 'page' : undefined"
        >{{ item.title }}</a
      >
      <button v-bind="api.triggerProps" class="vow-sidebar__toggle" aria-label="Toggle section">
        <Icon name="chevron-down" class="vow-sidebar__caret" />
      </button>
    </div>
    <a
      v-else
      :href="item.path"
      class="vow-sidebar__link"
      :class="{ 'is-active': item.path === path }"
      :aria-current="item.path === path ? 'page' : undefined"
      >{{ item.title }}</a
    >
    <ul
      v-if="hasChildren"
      v-bind="api.contentProps"
      v-show="open"
      class="vow-sidebar__items vow-sidebar__sub"
    >
      <SidebarItem v-for="sub in item.items" :key="sub.path" :item="sub" :path="path" />
    </ul>
  </li>
</template>
