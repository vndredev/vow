<script setup lang="ts">
import type { SidebarGroup } from "./index.ts";
import SidebarGroupView from "./SidebarGroup.vue";

// The docs sidebar — the first composed UI component (a molecule): groups of links, each group a
// Collapsible primitive. Data-driven from the frontmatter-derived structure.
defineProps<{ groups: SidebarGroup[]; path: string }>();
</script>

<template>
  <nav class="vow-sidebar" aria-label="Documentation">
    <SidebarGroupView v-for="group in groups" :key="group.title" :group="group" :path="path" />
  </nav>
</template>
