<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from "vue";
import type { TocEntry } from "./index.ts";

// The "on this page" rail — the page's h2/h3 headings, linking to their anchors. Scroll-spy highlights
// the heading currently in view (an IntersectionObserver over the heading ids).
const props = defineProps<{ items: TocEntry[] }>();
const active = ref("");
let observer: IntersectionObserver | undefined;

function observe(): void {
  observer?.disconnect();
  if (typeof IntersectionObserver === "undefined" || props.items.length === 0) return;
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) if (entry.isIntersecting) active.value = entry.target.id;
    },
    { rootMargin: "0px 0px -66% 0px", threshold: 0 },
  );
  for (const item of props.items) {
    const el = document.getElementById(item.slug);
    if (el) observer.observe(el);
  }
}

watch(
  () => props.items,
  () => {
    active.value = props.items[0]?.slug ?? "";
    void nextTick(observe);
  },
  { immediate: true },
);
onBeforeUnmount(() => observer?.disconnect());
</script>

<template>
  <aside v-if="items.length > 0" class="vow-toc" aria-label="On this page">
    <div class="vow-toc__title">On this page</div>
    <ul class="vow-toc__list">
      <li v-for="item in items" :key="item.slug" :class="`vow-toc__item--l${item.level}`">
        <a :href="`#${item.slug}`" :class="{ 'is-active': item.slug === active }">{{
          item.text
        }}</a>
      </li>
    </ul>
  </aside>
</template>
