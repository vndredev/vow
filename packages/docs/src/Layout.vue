<script setup lang="ts">
import { computed } from "vue";
import type { DocsConfig, SidebarGroup, TocEntry } from "./index.ts";
import Nav from "./Nav.vue";
import Sidebar from "./Sidebar.vue";
import Toc from "./Toc.vue";

// The docs chrome: top nav + (for docs pages) sidebar + content + the "on this page" TOC. The home
// is full-width (nav only). Styling: @vow/docs/style.css.
const props = defineProps<{
  config: DocsConfig;
  groups: SidebarGroup[];
  tocByPath: Record<string, TocEntry[]>;
  path: string;
}>();
const isDocPage = computed(() => props.path.startsWith("/guide"));
const toc = computed(() => props.tocByPath[props.path] ?? []);
</script>

<template>
  <div class="vow-docs">
    <Nav :config="config" />
    <div v-if="isDocPage" class="vow-docs-layout">
      <Sidebar :groups="groups" :path="path" />
      <main class="vow-docs-content"><slot /></main>
      <Toc :items="toc" />
    </div>
    <main v-else class="vow-docs-home"><slot /></main>
  </div>
</template>
