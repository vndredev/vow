<script setup lang="ts">
import { activeSet } from "./index.ts";
import type { IconName } from "./index.ts";

// A vow icon — renders the active icon library's SVG for a semantic name. The set is swappable
// (Lucide today; Heroicons / Phosphor next), like the framework adapters. Sizes with font-size (1em),
// colours with currentColor.
defineProps<{ name: IconName }>();
</script>

<template>
  <svg
    class="vow-icon"
    viewBox="0 0 24 24"
    width="1em"
    height="1em"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    v-html="activeSet[name]"
  />
</template>
