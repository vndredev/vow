<script setup lang="ts">
import { dialog } from "@vow/headless";
import { computed, nextTick, ref, watch } from "vue";
import type { SearchItem } from "./index.ts";

// Search (⌘K) — a dialog (vow's own primitive: Esc + tab-trap) with a substring filter over the page +
// heading index. Arrow keys move the highlight, Enter navigates. Closes on overlay click or Esc.
const props = defineProps<{ items: SearchItem[]; open: boolean }>();
const emit = defineEmits<{ "update:open": [boolean] }>();
const query = ref("");
const active = ref(0);
const input = ref<HTMLInputElement>();

const api = computed(() =>
  dialog({ open: props.open, id: "search" }, (next) => emit("update:open", next.open)),
);
const results = computed<SearchItem[]>(() => {
  const q = query.value.trim().toLowerCase();
  if (q === "") return [];
  return props.items.filter((item) => item.label.toLowerCase().includes(q)).slice(0, 12);
});

watch(
  () => props.open,
  (open) => {
    if (open) {
      query.value = "";
      active.value = 0;
      void nextTick(() => input.value?.focus());
    }
  },
);
watch(results, () => {
  active.value = 0;
});

function go(item: SearchItem | undefined): void {
  if (!item) return;
  emit("update:open", false);
  window.history.pushState(null, "", item.path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
function onKeydown(event: KeyboardEvent): void {
  if (event.key === "ArrowDown") {
    event.preventDefault();
    active.value = Math.min(active.value + 1, results.value.length - 1);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    active.value = Math.max(active.value - 1, 0);
  } else if (event.key === "Enter") {
    event.preventDefault();
    go(results.value[active.value]);
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="vow-search">
      <div v-bind="api.overlayProps" class="vow-search__overlay" />
      <div v-bind="api.contentProps" class="vow-search__panel" @keydown="onKeydown">
        <input
          ref="input"
          v-model="query"
          class="vow-search__input"
          type="text"
          placeholder="Search the docs"
          aria-label="Search"
        />
        <ul v-if="results.length > 0" class="vow-search__results">
          <li v-for="(item, i) in results" :key="item.path">
            <a
              :href="item.path"
              class="vow-search__result"
              :class="{ 'is-active': i === active }"
              @click.prevent="go(item)"
              @mousemove="active = i"
            >
              <span class="vow-search__label">{{ item.label }}</span>
              <span v-if="item.section" class="vow-search__section">{{ item.section }}</span>
            </a>
          </li>
        </ul>
        <div v-else-if="query !== ''" class="vow-search__empty">No results</div>
      </div>
    </div>
  </Teleport>
</template>
