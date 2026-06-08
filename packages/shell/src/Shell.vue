<script setup lang="ts">
import { ref } from "vue";
import Drawer from "./Drawer.vue";
import SidebarNav from "./SidebarNav.vue";
import type { Page } from "./index.ts";

const props = withDefaults(
  defineProps<{
    /** The routed pages (non-root views + forms) for the sidebar nav. */
    pages: readonly Page[];
    /** The current pathname — marks the active nav link. */
    path: string;
    /** The app name, shown as the brand (links to `/`). */
    title?: string;
    /** The shell layout. Only `sidebar` today; `top` is the reserved seam for a future top-nav shell. */
    variant?: "sidebar";
  }>(),
  { title: "vow app", variant: "sidebar" },
);

const drawerOpen = ref(false);
</script>

<template>
  <div class="vow-shell" :data-variant="variant">
    <!-- mobile bar: hamburger + brand (hidden ≥ 960px; the sidebar shows instead) -->
    <header class="vow-shell__bar">
      <button
        type="button"
        class="vow-shell__burger"
        aria-label="Open navigation"
        @click="drawerOpen = true"
      >
        <span /><span /><span />
      </button>
      <a class="vow-shell__bar-brand" href="/">{{ props.title }}</a>
      <div class="vow-shell__bar-actions"><slot name="topbar-actions" /></div>
    </header>

    <!-- desktop sidebar (hidden < 960px; the drawer shows instead) -->
    <aside class="vow-shell__sidebar">
      <SidebarNav :pages="pages" :path="path" :title="props.title">
        <template #footer><slot name="sidebar-footer" /></template>
      </SidebarNav>
    </aside>

    <!-- mobile drawer: the same sidebar in a dialog -->
    <Drawer v-model:open="drawerOpen" :path="path">
      <SidebarNav :pages="pages" :path="path" :title="props.title">
        <template #footer><slot name="sidebar-footer" /></template>
      </SidebarNav>
    </Drawer>

    <main class="vow-shell__main">
      <div class="vow-shell__content"><slot /></div>
    </main>
  </div>
</template>
