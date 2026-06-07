<script setup lang="ts">
import type { DocsConfig, SidebarGroup } from "./index.ts";
import Nav from "./Nav.vue";
import Sidebar from "./Sidebar.vue";

// The docs chrome: top nav + sidebar + the routed page. The router renders this around every page
// (passing `path`); the page lands in the default slot.
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

<style>
.vow-docs {
  --vow-nav-h: 56px;
}
.vow-nav {
  position: sticky;
  top: 0;
  z-index: 10;
  height: var(--vow-nav-h);
  background: var(--vow-color-bg);
  border-bottom: var(--vow-border) solid var(--vow-color-border);
}
.vow-nav__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--vow-space-4);
  height: 100%;
  max-width: 80rem;
  margin: 0 auto;
  padding: 0 var(--vow-space-6);
}
.vow-nav__title {
  font-size: var(--vow-text-lg);
  font-weight: var(--vow-weight-bold);
  color: var(--vow-color-text);
  text-decoration: none;
}
.vow-nav__links {
  display: flex;
  align-items: center;
  gap: var(--vow-space-5);
}
.vow-nav__links a {
  font-size: var(--vow-text-sm);
  font-weight: var(--vow-weight-medium);
  color: var(--vow-color-muted);
  text-decoration: none;
}
.vow-nav__links a:hover {
  color: var(--vow-color-text);
}
.vow-docs-layout {
  display: grid;
  grid-template-columns: 16rem minmax(0, 1fr);
  gap: var(--vow-space-7);
  max-width: 80rem;
  margin: 0 auto;
  padding: var(--vow-space-7) var(--vow-space-6);
}
.vow-docs-content {
  min-width: 0;
}
.vow-sidebar {
  position: sticky;
  top: calc(var(--vow-nav-h) + var(--vow-space-6));
  align-self: start;
  display: flex;
  flex-direction: column;
  gap: var(--vow-space-5);
}
.vow-sidebar__heading {
  width: 100%;
  margin: 0 0 var(--vow-space-2);
  padding: 0;
  font: inherit;
  font-size: var(--vow-text-sm);
  font-weight: var(--vow-weight-bold);
  color: var(--vow-color-text);
  text-align: left;
  background: none;
  border: none;
  cursor: pointer;
}
.vow-sidebar__items {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}
.vow-sidebar__link {
  display: block;
  padding: var(--vow-space-1) 0;
  font-size: var(--vow-text-sm);
  color: var(--vow-color-muted);
  text-decoration: none;
}
.vow-sidebar__link:hover {
  color: var(--vow-color-text);
}
.vow-sidebar__link.is-active {
  color: var(--vow-color-accent);
  font-weight: var(--vow-weight-medium);
}
</style>
