<script setup lang="ts">
import { computed, ref } from "vue";
import Drawer from "./Drawer.vue";
import SidebarNav from "./SidebarNav.vue";
import DarkToggle from "./DarkToggle.vue";
import Icon from "@vow/icons/Icon.vue";
import { buildNav, type Page } from "./index.ts";

const props = withDefaults(
  defineProps<{
    /** The routed pages (non-root views + forms) for the nav. */
    pages: readonly Page[];
    /** The current pathname — marks the active nav link. */
    path: string;
    /** The app name, shown as the brand (links to `/`). */
    title?: string;
    /** Where the nav lives. */
    nav?: "sidebar-left" | "sidebar-right" | "header" | "footer";
    /** The content width (per app). */
    width?: "center" | "full";
    /** The chrome's visual style. */
    variant?: "bordered" | "seamless" | "cards";
  }>(),
  { title: "vow app", nav: "sidebar-left", width: "center", variant: "bordered" },
);

const isSidebar = computed(() => props.nav === "sidebar-left" || props.nav === "sidebar-right");
const drawerOpen = ref(false);
// the bar (header/footer) lists links flat — Home first, then every page (groups are a sidebar idea)
const topLinks = computed<Page[]>(() => buildNav(props.pages).flatMap((s) => s.items));
</script>

<template>
  <div class="vow-shell" :data-nav="nav" :data-width="width" :data-variant="variant">
    <!-- header / footer: one horizontal bar (brand + flat nav + theme); CSS places it top or bottom -->
    <header v-if="!isSidebar" class="vow-shell__topnav">
      <a class="vow-shell__brand" href="/">{{ props.title }}</a>
      <nav class="vow-shell__topnav-links">
        <a
          v-for="link in topLinks"
          :key="link.path"
          class="vow-shell__link"
          :class="{ 'is-active': path === link.path }"
          :href="link.path"
          :aria-current="path === link.path ? 'page' : undefined"
        >
          <Icon v-if="link.icon" :name="link.icon" class="vow-shell__link-icon" />
          <span>{{ link.title }}</span>
        </a>
      </nav>
      <DarkToggle />
    </header>

    <!-- sidebar-left / sidebar-right: a mobile bar, a desktop sidebar, and the same nav in a drawer -->
    <template v-if="isSidebar">
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

      <aside class="vow-shell__sidebar">
        <SidebarNav :pages="pages" :path="path" :title="props.title">
          <template #footer><slot name="sidebar-footer" /></template>
        </SidebarNav>
      </aside>

      <Drawer v-model:open="drawerOpen" :path="path">
        <SidebarNav :pages="pages" :path="path" :title="props.title">
          <template #footer><slot name="sidebar-footer" /></template>
        </SidebarNav>
      </Drawer>
    </template>

    <main class="vow-shell__main">
      <div class="vow-shell__content"><slot /></div>
    </main>
  </div>
</template>
