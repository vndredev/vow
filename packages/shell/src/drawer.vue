<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import type { Maybe } from "@vow/core";
import { dialog } from "@vow/headless";

/*
 * The mobile nav drawer: a left panel over a dismiss overlay, on vow's own `dialog()` primitive (Esc +
 * tab-trap from the core). Locks body scroll, restores focus on close, and closes on overlay click, Esc,
 * or after navigating (the path changes). The panel content is the sidebar, passed in as the slot.
 */
const props = defineProps<{ open: boolean; path: string }>();
const emit = defineEmits<{ "update:open": [boolean] }>();
const content = ref<HTMLElement>();
/* The element focused before the drawer opened — restored on close. `absent` is a typed undefined. */
const { absent }: { readonly absent?: HTMLElement } = {};
let restore: Maybe<HTMLElement> = absent;
const api = computed(() =>
  dialog({ id: "shell-nav", open: props.open }, (next) => {
    emit("update:open", next.open);
  }),
);

async function openDrawer(): Promise<void> {
  const active = document.activeElement;
  if (active instanceof HTMLElement) {
    restore = active;
  }
  document.body.style.overflow = "hidden";
  await nextTick();
  content.value?.focus();
}

function closeDrawer(): void {
  document.body.style.overflow = "";
  restore?.focus();
}

watch(
  () => props.open,
  async (open): Promise<void> => {
    if (open) {
      await openDrawer();
    } else {
      closeDrawer();
    }
  },
);
/* Navigating dismisses the drawer. */
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
