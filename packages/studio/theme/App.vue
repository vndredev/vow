<script setup lang="ts">
import { computed } from "vue";
import type { StudioConfig } from "../src/config.ts";
import type { SidebarGroup } from "../src/sidebar.ts";
import Nav from "./Nav.vue";
import type { StudioRouter } from "./router.ts";
import Sidebar from "./Sidebar.vue";
import Toc from "./Toc.vue";

// The shell: fixed nav, grouped sidebar, the routed page in the content column, and the TOC rail.
// The router + the (virtual) sidebar/config tables are supplied by the client/server entries.
const props = defineProps<{
  router: StudioRouter;
  sidebar: readonly SidebarGroup[];
  config: StudioConfig;
}>();

const page = computed(() => props.router.page.value);
const currentPath = computed(() => props.router.path.value);
const isHome = computed(() => props.router.layout.value === "home");
</script>

<template>
  <Nav :config="config" />
  <div v-if="isHome" class="vow-home-wrap">
    <component :is="page" v-if="page" />
  </div>
  <div v-else class="vow-layout">
    <Sidebar :groups="sidebar" :current-path="currentPath" />
    <main class="vow-doc">
      <component :is="page" v-if="page" />
    </main>
    <Toc :toc="[]" />
  </div>
</template>
