<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import type { DocsConfig } from "./index.ts";
import Icon from "@vow/icons/Icon.vue";

// The top nav — site title + links + a tri-state theme button that CYCLES system → light → dark. The
// Theme class is set before first paint by index.html; an explicit choice persists in localStorage,
// And "system" clears it (so you can always get auto back) and follows the OS live.
defineProps<{ config: DocsConfig; sidebarOpen?: boolean }>();
const emit = defineEmits<{ toggleSidebar: []; openSearch: [] }>();

type Theme = "system" | "light" | "dark";
const NEXT_THEME: Record<Theme, Theme> = { dark: "system", light: "dark", system: "light" };
const THEME_ICON: Record<Theme, string> = { dark: "moon", light: "sun", system: "monitor" };
const theme = ref<Theme>("system");
const media = globalThis.matchMedia("(prefers-color-scheme: dark)");
const themeIcon = computed(() => THEME_ICON[theme.value]);

function isDarkFor(next: Theme): boolean {
  if (next === "system") {
    return media.matches;
  }
  return next === "dark";
}

function apply(next: Theme): void {
  theme.value = next;
  document.documentElement.classList.toggle("dark", isDarkFor(next));
  if (next === "system") {
    localStorage.removeItem("vow-theme");
  } else {
    localStorage.setItem("vow-theme", next);
  }
}
function cycleTheme(): void {
  apply(NEXT_THEME[theme.value]);
}
function onSystemChange(event: MediaQueryListEvent): void {
  if (theme.value === "system") {
    document.documentElement.classList.toggle("dark", event.matches);
  }
}

onMounted(() => {
  const stored = localStorage.getItem("vow-theme");
  if (stored === "light" || stored === "dark") {
    theme.value = stored;
  }
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
