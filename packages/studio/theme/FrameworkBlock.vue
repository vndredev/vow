<script setup lang="ts">
import { computed } from "vue";
import { metaFor, useFramework } from "./useFramework.ts";

// Wraps framework-specific content (mainly the generated adapter code). The slot holds today's real
// output — Vue. When a *planned* framework is selected, the same Vue output stays visible but gets an
// honest banner: that adapter is on the roadmap, this is the Vue generate for reference. So switching
// is real (the page reacts) without ever faking framework code vow doesn't yet emit.
const framework = useFramework();
const meta = computed(() => metaFor(framework.value));
const planned = computed(() => meta.value.status === "planned");
</script>

<template>
  <div class="vow-fw-block">
    <div v-if="planned" class="vow-fw-block__notice" data-kind="warning">
      <strong>{{ meta.label }} adapter is on the roadmap.</strong>
      vow generates one component model into many framework adapters; only Vue ships today. Here's
      the current Vue output for reference — see the <a href="/guide/roadmap">Roadmap</a>.
    </div>
    <slot />
  </div>
</template>

<style scoped>
.vow-fw-block__notice {
  margin: var(--vow-space-4) 0 var(--vow-space-2);
  padding: var(--vow-space-3) var(--vow-space-4);
  font-size: var(--vow-text-sm);
  line-height: var(--vow-leading-relaxed);
  color: var(--vow-color-text);
  background: var(--vow-color-surface);
  border: var(--vow-border) solid var(--vow-color-border);
  border-left: 3px solid var(--vow-color-accent);
  border-radius: var(--vow-radius-2);
}
</style>
