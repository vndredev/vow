<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  FRAMEWORKS,
  initFramework,
  setFramework,
  useFramework,
  type FrameworkId,
} from "./useFramework";

// The header framework picker — a compact pill right after the "vow" title. It must live OUTSIDE the
// title's home-link <a> (a <select> inside an anchor is invalid HTML and hijacks clicks to "/"), so we
// Teleport it next to the anchor, into `.VPNavBarTitle`, on the client. SSR renders nothing (no
// hydration mismatch); after mount the picker appears and the stored choice is applied.
const framework = useFramework();
const mounted = ref(false);
onMounted(() => {
  initFramework();
  mounted.value = true;
});

function onChange(event: Event): void {
  setFramework((event.target as HTMLSelectElement).value as FrameworkId);
}
</script>

<template>
  <Teleport v-if="mounted" to=".VPNavBarTitle">
    <select
      class="fw-switcher"
      :value="framework"
      aria-label="Target framework"
      title="Target framework"
      @change="onChange"
    >
      <option v-for="f in FRAMEWORKS" :key="f.id" :value="f.id">
        {{ f.label }}{{ f.status === "planned" ? " · planned" : "" }}
      </option>
    </select>
  </Teleport>
</template>

<style scoped>
.fw-switcher {
  flex: none;
  margin-left: 0.6rem;
  padding: 0.1rem 1.35rem 0.1rem 0.55rem;
  font-family: inherit;
  font-size: 0.72rem;
  font-weight: 600;
  line-height: 1.6;
  color: var(--vp-c-text-2);
  background: var(--vp-c-bg-soft)
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='%23999' stroke-width='1.5'%3E%3Cpath d='M4 6l4 4 4-4'/%3E%3C/svg%3E")
    no-repeat right 0.4rem center / 0.7rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
  cursor: pointer;
  appearance: none;
  transition:
    border-color 0.2s,
    color 0.2s;
}
.fw-switcher:hover {
  color: var(--vp-c-text-1);
  border-color: var(--vp-c-brand-1);
}
</style>

<!-- Global: lay the title's anchor + the teleported pill in a row, and shrink the anchor to its content
     so the home-link is just the "vow" logo (not the whole empty column) and the pill sits beside it. -->
<style>
.VPNavBarTitle {
  display: flex;
  align-items: center;
}
.VPNavBarTitle > .title {
  width: auto;
}
</style>
