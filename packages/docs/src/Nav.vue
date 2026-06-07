<script setup lang="ts">
import Icon from "@vow/icons/Icon.vue";
import { onBeforeUnmount, onMounted, ref } from "vue";
import type { DocsConfig } from "./index.ts";

// The top nav — site title (links home) + configured links + a dark-mode toggle. A native button is
// accessible on its own (no Switch primitive needed). The theme class is set before first paint by the
// index.html boot script; here we sync the ref, persist a user toggle, and follow the OS while the user
// hasn't overridden it (true auto). On mobile a hamburger emits `toggleSidebar` (the Layout opens it).
defineProps<{ config: DocsConfig; sidebarOpen?: boolean }>();
const emit = defineEmits<{ toggleSidebar: []; openSearch: [] }>();

const dark = ref(false);
const media = window.matchMedia("(prefers-color-scheme: dark)");

function setClass(value: boolean): void {
  dark.value = value;
  document.documentElement.classList.toggle("dark", value);
}
function toggle(): void {
  setClass(!dark.value);
  localStorage.setItem("vow-theme", dark.value ? "dark" : "light"); // an explicit choice persists
}
function onSystemChange(event: MediaQueryListEvent): void {
  if (!localStorage.getItem("vow-theme")) setClass(event.matches); // follow the OS until overridden
}

onMounted(() => {
  dark.value = document.documentElement.classList.contains("dark"); // the boot script already set it
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
        aria-label="Open menu"
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
          :aria-pressed="dark"
          aria-label="Toggle dark mode"
          @click="toggle"
        >
          <Icon :name="dark ? 'sun' : 'moon'" />
        </button>
      </nav>
    </div>
  </header>
</template>
