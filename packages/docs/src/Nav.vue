<script setup lang="ts">
import type { DocsConfig } from "./index.ts";

// The top nav — the site title (links home) + the configured links.
defineProps<{ config: DocsConfig }>();
</script>

<template>
  <header class="vow-nav">
    <div class="vow-nav__inner">
      <a href="/" class="vow-nav__title">{{ config.title }}</a>
      <nav class="vow-nav__links" aria-label="Primary">
        <a v-for="link in config.nav" :key="link.link" :href="link.link">{{ link.text }}</a>
      </nav>
    </div>
  </header>
</template>
