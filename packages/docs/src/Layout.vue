<script setup lang="ts">
import { computed, ref } from "vue";
import type { DocsConfig, SidebarGroup, TocEntry } from "./index.ts";
import MobileSidebar from "./MobileSidebar.vue";
import Nav from "./Nav.vue";
import Sidebar from "./Sidebar.vue";
import Toc from "./Toc.vue";

// The docs chrome: top nav + (for docs pages) sidebar + content + the "on this page" TOC. The home is
// full-width (nav only). On mobile the sidebar collapses into a drawer (the hamburger in the nav opens
// it). Styling: @vow/docs/style.css.
const props = defineProps<{
  config: DocsConfig;
  groups: SidebarGroup[];
  tocByPath: Record<string, TocEntry[]>;
  path: string;
}>();
const isDocPage = computed(() => props.path.startsWith("/guide"));
const toc = computed(() => props.tocByPath[props.path] ?? []);
const mobileOpen = ref(false);
</script>

<template>
  <div class="vow-docs">
    <Nav :config="config" @toggle-sidebar="mobileOpen = true" />
    <div v-if="isDocPage" class="vow-docs-layout">
      <Sidebar :groups="groups" :path="path" />
      <main class="vow-docs-content"><slot /></main>
      <Toc :items="toc" />
    </div>
    <main v-else class="vow-docs-home"><slot /></main>
    <MobileSidebar v-model:open="mobileOpen" :groups="groups" :path="path" />
  </div>
</template>
