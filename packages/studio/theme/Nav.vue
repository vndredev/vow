<script setup lang="ts">
import type { StudioConfig } from "../src/config.ts";

defineProps<{ config: StudioConfig }>();

/** Dark mode is a `.dark` class on <html>; the toggle is a plain button (HTML is already accessible). */
function toggleDark(): void {
  if (typeof document !== "undefined") document.documentElement.classList.toggle("dark");
}
</script>

<template>
  <header class="vow-nav">
    <div class="vow-nav__inner">
      <a class="vow-nav__title" href="/">{{ config.title }}</a>
      <nav class="vow-nav__links" aria-label="Primary">
        <a v-for="link in config.nav ?? []" :key="link.link" :href="link.link">{{ link.text }}</a>
        <button
          class="vow-nav__dark"
          type="button"
          aria-label="Toggle dark mode"
          @click="toggleDark"
        >
          ◐
        </button>
      </nav>
    </div>
  </header>
</template>
