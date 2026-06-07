<script setup lang="ts">
import Icon from "@vow/icons/Icon.vue";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import type { DocsConfig } from "./index.ts";

// The top nav — site title + links + a tri-state theme button that CYCLES system → light → dark. The
// theme class is set before first paint by index.html; an explicit choice persists in localStorage,
// and "system" clears it (so you can always get auto back) and follows the OS live.
defineProps<{ config: DocsConfig; sidebarOpen?: boolean }>();
const emit = defineEmits<{ toggleSidebar: []; openSearch: [] }>();

type Theme = "system" | "light" | "dark";
const theme = ref<Theme>("system");
const media = window.matchMedia("(prefers-color-scheme: dark)");
const themeIcon = computed(() =>
  theme.value === "system" ? "monitor" : theme.value === "dark" ? "moon" : "sun",
);

function apply(next: Theme): void {
  theme.value = next;
  const isDark = next === "system" ? media.matches : next === "dark";
  document.documentElement.classList.toggle("dark", isDark);
  if (next === "system") localStorage.removeItem("vow-theme");
  else localStorage.setItem("vow-theme", next);
}
function cycleTheme(): void {
  apply(theme.value === "system" ? "light" : theme.value === "light" ? "dark" : "system");
}
function onSystemChange(event: MediaQueryListEvent): void {
  if (theme.value === "system") document.documentElement.classList.toggle("dark", event.matches);
}

onMounted(() => {
  const stored = localStorage.getItem("vow-theme");
  theme.value = stored === "light" || stored === "dark" ? stored : "system";
  media.addEventListener("change", onSystemChange);
});
onBeforeUnmount(() => media.removeEventListener("change", onSystemChange));
</script>

<template>
  <header class="vow-nav">
    <div class="vow-nav__inner">
      <button
        type="button"
        class="vow-nav__menu"
        :aria-label="sidebarOpen ? 'Close menu' : 'Open menu'"
        :aria-expanded="sidebarOpen ?? false"
        @click="emit('toggleSidebar')"
      >
        <Icon name="menu" />
      </button>
      <a href="/" class="vow-nav__title">{{ config.title }}</a>
      <nav class="vow-nav__links" aria-label="Primary">
        <button
          type="button"
          class="vow-nav__search"
          aria-label="Search"
          @click="emit('openSearch')"
        >
          <Icon name="search" />
          <span>Search</span>
          <kbd class="vow-nav__kbd">⌘K</kbd>
        </button>
        <a v-for="link in config.nav" :key="link.link" :href="link.link">{{ link.text }}</a>
        <button
          type="button"
          class="vow-nav__dark"
          :aria-label="`Theme: ${theme} (click to change)`"
          :title="`Theme: ${theme}`"
          @click="cycleTheme"
        >
          <Icon :name="themeIcon" />
        </button>
      </nav>
    </div>
  </header>
</template>
