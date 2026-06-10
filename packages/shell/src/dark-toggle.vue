<script setup lang="ts">
import Icon from "@vow/icons/Icon.vue";
import { useTheme } from "./use-theme.ts";

/*
 * The button is presentation only; the tri-state logic + shared state live in useTheme (so the sidebar
 * and the mobile drawer stay in sync).
 */
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
