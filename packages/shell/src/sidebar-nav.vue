<script setup lang="ts">
import DarkToggle from "./dark-toggle.vue";
import Icon from "@vow/icons/Icon.vue";
import type { Page } from "./types.ts";
import { buildNav } from "./index.ts";
import { computed } from "vue";

/*
 * The sidebar's content — brand, page nav, footer (dark toggle). Rendered in two places: the desktop
 * sidebar and the mobile drawer. Pure presentation; the active link is the current `path`. The
 * grouping/ordering lives in `buildNav` (tested without a mount).
 */
const props = defineProps<{ pages: readonly Page[]; path: string; title: string }>();
const sections = computed(() => buildNav(props.pages));
</script>

<template>
  <div class="vow-shell__sidebar-inner">
    <a class="vow-shell__brand" href="/">{{ title }}</a>
    <nav class="vow-shell__nav">
      <template v-for="(section, i) in sections" :key="i">
        <div v-if="section.title" class="vow-shell__nav-group">{{ section.title }}</div>
        <a
          v-for="link in section.items"
          :key="link.path"
          class="vow-shell__link"
          :class="{ 'is-active': path === link.path }"
          :href="link.path"
          :aria-current="path === link.path ? 'page' : undefined"
        >
          <Icon v-if="link.icon" :name="link.icon" class="vow-shell__link-icon" />
          <span>{{ link.title }}</span>
        </a>
      </template>
    </nav>
    <div class="vow-shell__sidebar-footer">
      <slot name="footer" />
      <DarkToggle />
    </div>
  </div>
</template>
