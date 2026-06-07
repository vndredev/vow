<script setup lang="ts">
import type { TocEntry } from "../src/markdown/toc.ts";

// The right-rail outline of a page's h2/h3 headings (anchors to their slug ids).
defineProps<{ toc: readonly TocEntry[] }>();
</script>

<template>
  <nav v-if="toc.length > 0" class="vow-toc" aria-label="On this page">
    <span class="vow-toc__title">On this page</span>
    <ul class="vow-toc__list">
      <li v-for="entry in toc" :key="entry.slug" :class="`vow-toc__item--l${entry.level}`">
        <a :href="`#${entry.slug}`">{{ entry.text }}</a>
      </li>
    </ul>
  </nav>
</template>
