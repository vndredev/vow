<script setup lang="ts">
import { onMounted, ref } from "vue";
import type { DocsConfig } from "./index.ts";

// The top nav — site title (links home) + configured links + a dark-mode toggle. A native button is
// accessible on its own (no Switch primitive needed). State lives on `<html class="dark">`. On mobile
// a hamburger emits `toggleSidebar` (the Layout opens the drawer).
defineProps<{ config: DocsConfig }>();
const emit = defineEmits<{ toggleSidebar: []; openSearch: [] }>();

const dark = ref(false);

function apply(value: boolean): void {
  dark.value = value;
  document.documentElement.classList.toggle("dark", value);
  localStorage.setItem("vow-theme", value ? "dark" : "light");
}

onMounted(() => {
  const stored = localStorage.getItem("vow-theme");
  apply(stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches);
});
</script>

<template>
  <header class="vow-nav">
    <div class="vow-nav__inner">
      <button
        type="button"
        class="vow-nav__menu"
        aria-label="Open menu"
        @click="emit('toggleSidebar')"
      >
        ☰
      </button>
      <a href="/" class="vow-nav__title">{{ config.title }}</a>
      <nav class="vow-nav__links" aria-label="Primary">
        <button
          type="button"
          class="vow-nav__search"
          aria-label="Search"
          @click="emit('openSearch')"
        >
          <span>Search</span>
          <kbd class="vow-nav__kbd">⌘K</kbd>
        </button>
        <a v-for="link in config.nav" :key="link.link" :href="link.link">{{ link.text }}</a>
        <button
          type="button"
          class="vow-nav__dark"
          :aria-pressed="dark"
          aria-label="Toggle dark mode"
          @click="apply(!dark)"
        >
          {{ dark ? "☀" : "☾" }}
        </button>
      </nav>
    </div>
  </header>
</template>
