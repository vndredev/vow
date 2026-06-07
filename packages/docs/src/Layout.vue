<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import type { DocsConfig, SearchItem, SidebarGroup, TocEntry } from "./index.ts";
import MobileSidebar from "./MobileSidebar.vue";
import Nav from "./Nav.vue";
import Search from "./Search.vue";
import Sidebar from "./Sidebar.vue";
import Toc from "./Toc.vue";

// The docs chrome: top nav + (for docs pages) sidebar + content + the "on this page" TOC. The home is
// full-width (nav only). On mobile the sidebar collapses into a drawer (the hamburger in the nav opens
// it). ⌘K / Ctrl-K opens search. Styling: @vow/docs/style.css.
const props = defineProps<{
  config: DocsConfig;
  groups: SidebarGroup[];
  tocByPath: Record<string, TocEntry[]>;
  search: SearchItem[];
  path: string;
}>();
// a doc page is any non-home route under the configured base (the home is full-width, nav only)
const isDocPage = computed(() => props.path !== "/" && props.path.startsWith(props.config.base));
const toc = computed(() => props.tocByPath[props.path] ?? []);
const mobileOpen = ref(false);
const searchOpen = ref(false);

function onKeydown(event: KeyboardEvent): void {
  if ((event.metaKey || event.ctrlKey) && event.key === "k") {
    event.preventDefault();
    searchOpen.value = true;
  }
}
onMounted(() => window.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <div class="vow-docs">
    <Nav
      :config="config"
      :sidebar-open="mobileOpen"
      @toggle-sidebar="mobileOpen = true"
      @open-search="searchOpen = true"
    />
    <div v-if="isDocPage" class="vow-docs-layout">
      <Sidebar :groups="groups" :path="path" />
      <main class="vow-docs-content"><slot /></main>
      <Toc :items="toc" />
    </div>
    <main v-else class="vow-docs-home"><slot /></main>
    <MobileSidebar v-model:open="mobileOpen" :groups="groups" :path="path" />
    <Search v-model:open="searchOpen" :items="search" />
  </div>
</template>
