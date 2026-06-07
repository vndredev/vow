<script setup lang="ts">
import type { DocsConfig, SidebarGroup } from "./index.ts";
import Nav from "./Nav.vue";
import Sidebar from "./Sidebar.vue";

// The docs chrome: top nav + sidebar + the routed page. The router renders this around every page
// (passing `path`); the page lands in the default slot. All styling lives in @vow/docs/style.css.
defineProps<{ config: DocsConfig; groups: SidebarGroup[]; path: string }>();
</script>

<template>
  <div class="vow-docs">
    <Nav :config="config" />
    <div class="vow-docs-layout">
      <Sidebar :groups="groups" :path="path" />
      <main class="vow-docs-content"><slot /></main>
    </div>
  </div>
</template>
