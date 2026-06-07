<script setup lang="ts">
import { computed } from "vue";
import { metaFor, useFramework } from "./useFramework";

// Wraps framework-specific content (mainly the generated adapter code). The slot holds today's real
// output — Vue. When a *planned* framework is selected, the same Vue output stays visible but gets an
// honest banner: that adapter is on the roadmap, this is the Vue generate for reference. So switching
// is real (the page reacts) without ever faking framework code vow doesn't yet emit.
const framework = useFramework();
const meta = computed(() => metaFor(framework.value));
const planned = computed(() => meta.value.status === "planned");
</script>

<template>
  <div class="fw-block">
    <div v-if="planned" class="fw-block__notice">
      <strong>{{ meta.label }} adapter is on the roadmap.</strong>
      vow generates one component model into many framework adapters; only Vue ships today. Here's
      the current Vue output for reference — see the <a href="/guide/roadmap">Roadmap</a>.
    </div>
    <slot />
  </div>
</template>

<style scoped>
.fw-block__notice {
  margin: 1rem 0 0.5rem;
  padding: 0.75rem 1rem;
  font-size: 0.9rem;
  line-height: 1.5;
  color: var(--vp-c-text-1);
  background: var(--vp-c-warning-soft);
  border: 1px solid var(--vp-c-warning-1);
  border-radius: 8px;
}
.fw-block__notice strong {
  color: var(--vp-c-warning-1);
}
</style>
