<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { TocEntry } from "./index.ts";

// The "on this page" rail — the page's h2/h3 headings, linking to their anchors. Scroll-spy: the active
// entry is the last heading scrolled above the reading offset. A scroll listener (not IntersectionObserver)
// so the LAST sections still highlight at the bottom of the page, where they can't reach the top zone.
const props = defineProps<{ items: TocEntry[] }>();
const active = ref("");
const OFFSET = 100; // ~ nav height + a little; a heading counts as current once it passes this
let ticking = false;

function update(): void {
  ticking = false;
  if (props.items.length === 0) return; // no TOC on this page — nothing to track
  let current = props.items[0]?.slug ?? "";
  for (const item of props.items) {
    const el = document.getElementById(item.slug);
    if (el && el.getBoundingClientRect().top <= OFFSET) current = item.slug;
  }
  // at the page bottom the last sections are all on screen (never above the offset) — mark the last one
  const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
  if (atBottom) current = props.items[props.items.length - 1]?.slug ?? current;
  active.value = current;
}

function onScroll(): void {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(update);
}

onMounted(() => {
  window.addEventListener("scroll", onScroll, { passive: true });
  update();
});
onBeforeUnmount(() => window.removeEventListener("scroll", onScroll));
watch(
  () => props.items,
  () => void nextTick(update),
);
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
