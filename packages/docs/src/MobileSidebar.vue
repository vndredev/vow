<script setup lang="ts">
import { dialog } from "@vow/headless";
import { computed, nextTick, ref, watch } from "vue";
import type { SidebarGroup } from "./index.ts";
import Sidebar from "./Sidebar.vue";

// The mobile nav — the sidebar in a left drawer over a dismiss overlay, on vow's own `dialog()`
// primitive (Esc + tab-trap from the core). Closes on overlay click, Esc, or after navigating.
const props = defineProps<{ groups: SidebarGroup[]; path: string; open: boolean }>();
const emit = defineEmits<{ "update:open": [boolean] }>();
const content = ref<HTMLElement>();
const api = computed(() =>
  dialog({ open: props.open, id: "mobile-nav" }, (next) => emit("update:open", next.open)),
);

watch(
  () => props.open,
  (open) => {
    if (open) void nextTick(() => content.value?.focus());
  },
);
// navigating (the path changes) dismisses the drawer
watch(
  () => props.path,
  () => emit("update:open", false),
);
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="vow-mobile-nav">
      <div v-bind="api.overlayProps" class="vow-mobile-nav__overlay" />
      <div ref="content" v-bind="api.contentProps" class="vow-mobile-nav__drawer">
        <Sidebar :groups="groups" :path="path" />
      </div>
    </div>
  </Teleport>
</template>
