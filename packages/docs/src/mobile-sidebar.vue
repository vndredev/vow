<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import Sidebar from "./sidebar.vue";
import type { SidebarGroup } from "./index.ts";
import { dialog } from "@vow/headless";
import { withFocusedElement } from "./dom.ts";

// The mobile nav — the sidebar in a left drawer over a dismiss overlay, on vow's own `dialog()`
// Primitive (Esc + tab-trap from the core). Restores focus + body scroll on close; closes on overlay
// Click, Esc, or after navigating.
const props = defineProps<{ groups: SidebarGroup[]; path: string; open: boolean }>();
const emit = defineEmits<{ "update:open": [boolean] }>();
const content = ref<HTMLElement>();
const restore = ref<HTMLElement>();
const api = computed(() =>
  dialog({ id: "mobile-nav", open: props.open }, (next) => {
    emit("update:open", next.open);
  }),
);

watch(
  () => props.open,
  (open) => {
    if (open) {
      withFocusedElement((el) => {
        restore.value = el;
      });
      document.body.style.overflow = "hidden";
      nextTick(() => content.value?.focus());
    } else {
      document.body.style.overflow = "";
      restore.value?.focus();
    }
  },
);
// Navigating (the path changes) dismisses the drawer
watch(
  () => props.path,
  () => {
    emit("update:open", false);
  },
);
onBeforeUnmount(() => {
  document.body.style.overflow = "";
});
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="vow-mobile-nav">
      <div v-bind="api.overlayProps" class="vow-mobile-nav__overlay" />
      <div
        ref="content"
        v-bind="api.contentProps"
        class="vow-mobile-nav__drawer"
        aria-label="Navigation"
        :aria-labelledby="undefined"
      >
        <Sidebar :groups="groups" :path="path" />
      </div>
    </div>
  </Teleport>
</template>
