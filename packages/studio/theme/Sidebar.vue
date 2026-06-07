<script setup lang="ts">
import type { SidebarGroup } from "../src/sidebar.ts";
import SidebarGroupView from "./SidebarGroup.vue";

defineProps<{ groups: readonly SidebarGroup[]; currentPath: string }>();
</script>

<template>
  <nav class="vow-sidebar" aria-label="Documentation">
    <SidebarGroupView
      v-for="group in groups"
      :key="group.text"
      :group="group"
      :current-path="currentPath"
    />
  </nav>
</template>
