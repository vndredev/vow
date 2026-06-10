<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { TocEntry } from "./index.ts";

// The "on this page" rail — the page's h2/h3 headings, linking to their anchors. Scroll-spy: the active
// Entry is the last heading scrolled above the reading offset. A scroll listener (not IntersectionObserver)
// So the LAST sections still highlight at the bottom of the page, where they can't reach the top zone.
const props = defineProps<{ items: TocEntry[] }>();
const active = ref("");
// ~ Nav height + a little; a heading counts as current once it passes this
const OFFSET = 100;
// The page-bottom slack: the last sections never pass the offset, so allow this gap to the very end
const BOTTOM_SLACK = 2;
let ticking = false;

// The last heading scrolled above the reading offset; at the page bottom, the final heading wins
function activeSlug(items: readonly TocEntry[]): string {
  let current = items[0]?.slug ?? "";
  for (const item of items) {
    const el = document.querySelector(`#${item.slug}`);
    if (el && el.getBoundingClientRect().top <= OFFSET) {
      current = item.slug;
    }
  }
  const atBottom =
    globalThis.innerHeight + globalThis.scrollY >=
    document.documentElement.scrollHeight - BOTTOM_SLACK;
  if (atBottom) {
    current = items.at(-1)?.slug ?? current;
  }
  return current;
}

function update(): void {
  ticking = false;
  // No TOC on this page — nothing to track
  if (props.items.length === 0) {
    return;
  }
  active.value = activeSlug(props.items);
}

function onScroll(): void {
  if (ticking) {
    return;
  }
  ticking = true;
  requestAnimationFrame(update);
}

onMounted(() => {
  globalThis.addEventListener("scroll", onScroll, { passive: true });
  update();
});
onBeforeUnmount(() => globalThis.removeEventListener("scroll", onScroll));
watch(
  () => props.items,
  () => {
    nextTick(update);
  },
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
