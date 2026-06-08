<script setup lang="ts">
import { dialog } from "@vow/headless";
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";

// The mobile nav drawer: a left panel over a dismiss overlay, on vow's own `dialog()` primitive (Esc +
// tab-trap from the core). Locks body scroll, restores focus on close, and closes on overlay click, Esc,
// or after navigating (the path changes). The panel content is the sidebar, passed in as the slot.
const props = defineProps<{ open: boolean; path: string }>();
const emit = defineEmits<{ "update:open": [boolean] }>();
const content = ref<HTMLElement>();
let restore: HTMLElement | null = null;
const api = computed(() =>
  dialog({ open: props.open, id: "shell-nav" }, (next) => emit("update:open", next.open)),
);

watch(
  () => props.open,
  (open) => {
    if (open) {
      restore = document.activeElement as HTMLElement | null;
      document.body.style.overflow = "hidden";
      void nextTick(() => content.value?.focus());
    } else {
      document.body.style.overflow = "";
      restore?.focus();
    }
  },
);
// navigating dismisses the drawer
watch(
  () => props.path,
  () => emit("update:open", false),
);
onBeforeUnmount(() => {
  document.body.style.overflow = "";
});
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="vow-shell-drawer">
      <div v-bind="api.overlayProps" class="vow-shell-drawer__overlay" />
      <div
        ref="content"
        v-bind="api.contentProps"
        class="vow-shell-drawer__panel"
        aria-label="Navigation"
        :aria-labelledby="undefined"
      >
        <slot />
      </div>
    </div>
  </Teleport>
</template>
