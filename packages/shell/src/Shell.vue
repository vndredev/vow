<script setup lang="ts">
import { computed } from "vue";
import DarkToggle from "./DarkToggle.vue";
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

// the nav: Home (the root view) + every routed page; active-marked by the current path
const links = computed<Page[]>(() => [{ path: "/", title: "Home" }, ...props.pages]);
</script>

<template>
  <div class="vow-shell" :data-variant="variant">
    <aside class="vow-shell__sidebar">
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
        <slot name="sidebar-footer" />
        <DarkToggle />
      </div>
    </aside>
    <main class="vow-shell__main">
      <header v-if="$slots['topbar-actions']" class="vow-shell__topbar">
        <slot name="topbar-actions" />
      </header>
      <div class="vow-shell__content"><slot /></div>
    </main>
  </div>
</template>
