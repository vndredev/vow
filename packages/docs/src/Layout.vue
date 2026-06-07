<script setup lang="ts">
import { computed } from "vue";
import type { DocsConfig, SidebarGroup } from "./index.ts";
import Nav from "./Nav.vue";
import Sidebar from "./Sidebar.vue";

// The docs chrome: top nav + (for docs pages) the sidebar + the routed page. The home is full-width
// (nav only). The router renders this around every page (passing `path`). Styling: @vow/docs/style.css.
const props = defineProps<{ config: DocsConfig; groups: SidebarGroup[]; path: string }>();
const isDocPage = computed(() => props.path.startsWith("/guide"));
</script>

<template>
  <div class="vow-docs">
    <Nav :config="config" />
    <div v-if="isDocPage" class="vow-docs-layout">
      <Sidebar :groups="groups" :path="path" />
      <main class="vow-docs-content"><slot /></main>
    </div>
    <main v-else class="vow-docs-home"><slot /></main>
  </div>
</template>
