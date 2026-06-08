<script setup lang="ts">
import { computed } from "vue";
import DarkToggle from "./DarkToggle.vue";
import type { Page } from "./index.ts";

// The sidebar's content — brand, page nav, footer (dark toggle). Rendered in two places: the desktop
// sidebar and the mobile drawer. Pure presentation; the active link is the current `path`.
const props = defineProps<{ pages: readonly Page[]; path: string; title: string }>();
const links = computed<Page[]>(() => [{ path: "/", title: "Home" }, ...props.pages]);
</script>

<template>
  <div class="vow-shell__sidebar-inner">
    <a class="vow-shell__brand" href="/">{{ title }}</a>
    <nav class="vow-shell__nav">
      <a
        v-for="link in links"
        :key="link.path"
        class="vow-shell__link"
        :class="{ 'is-active': path === link.path }"
        :href="link.path"
        :aria-current="path === link.path ? 'page' : undefined"
        >{{ link.title }}</a
      >
    </nav>
    <div class="vow-shell__sidebar-footer">
      <slot name="footer" />
      <DarkToggle />
    </div>
  </div>
</template>
