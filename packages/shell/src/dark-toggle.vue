<script setup lang="ts">
// Generated dark-toggle chrome through @vow/component — do not edit. Logic lives in use-theme.ts.
// Carries class hooks only; vow's base look lives in @vow/theme (swappable).
import Icon from "@vow/icons/Icon.vue";
import { useTheme } from "./use-theme.ts";

const { theme, icon, cycle } = useTheme();
</script>

<template>
  <button
    type="button"
    class="vow-shell__theme"
    :aria-label="`Theme: ${theme}`"
    :title="`Theme: ${theme} — click to change`"
    @click="cycle"
  >
    <Icon :name="icon" />
    <span class="vow-shell__theme-label">{{ theme }}</span>
  </button>
</template>
