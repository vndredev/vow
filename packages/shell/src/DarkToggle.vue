<script setup lang="ts">
import Icon from "@vow/icons/Icon.vue";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

// A tri-state theme button: cycles system → light → dark. The `.dark` class is set before first paint by
// the app's index.html (no flash); an explicit choice persists in localStorage, "system" clears it (so
// auto comes back) and follows the OS live. Same logic as the docs chrome — shared by convention, not code.
type Theme = "system" | "light" | "dark";
const theme = ref<Theme>("system");
const media = window.matchMedia("(prefers-color-scheme: dark)");
const icon = computed(() =>
  theme.value === "system" ? "monitor" : theme.value === "dark" ? "moon" : "sun",
);

function apply(next: Theme): void {
  theme.value = next;
  const isDark = next === "system" ? media.matches : next === "dark";
  document.documentElement.classList.toggle("dark", isDark);
  if (next === "system") localStorage.removeItem("vow-theme");
  else localStorage.setItem("vow-theme", next);
}
function cycle(): void {
  apply(theme.value === "system" ? "light" : theme.value === "light" ? "dark" : "system");
}
function onSystemChange(event: MediaQueryListEvent): void {
  if (theme.value === "system") document.documentElement.classList.toggle("dark", event.matches);
}

onMounted(() => {
  const stored = localStorage.getItem("vow-theme");
  theme.value = stored === "light" || stored === "dark" ? stored : "system";
  media.addEventListener("change", onSystemChange);
});
onBeforeUnmount(() => media.removeEventListener("change", onSystemChange));
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
