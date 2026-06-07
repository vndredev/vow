<script setup lang="ts">
import type { TocEntry } from "./index.ts";

// The "on this page" rail — the page's h2/h3 headings (from @vow/markdown), linking to their anchors.
defineProps<{ items: TocEntry[] }>();
</script>

<template>
  <aside v-if="items.length > 0" class="vow-toc" aria-label="On this page">
    <div class="vow-toc__title">On this page</div>
    <ul class="vow-toc__list">
      <li v-for="item in items" :key="item.slug" :class="`vow-toc__item--l${item.level}`">
        <a :href="`#${item.slug}`">{{ item.text }}</a>
      </li>
    </ul>
  </aside>
</template>
