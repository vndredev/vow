<script setup lang="ts">
import type { SidebarGroup } from "./index.ts";
import Sidebar from "./Sidebar.vue";

// The docs chrome: the sidebar + the routed page. The router renders this around every page (passing
// `path`); the page lands in the default slot.
defineProps<{ groups: SidebarGroup[]; path: string }>();
</script>

<template>
  <div class="vow-docs-layout">
    <Sidebar :groups="groups" :path="path" />
    <main class="vow-docs-content"><slot /></main>
  </div>
</template>

<style>
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
  top: var(--vow-space-6);
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
