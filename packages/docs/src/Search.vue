<script setup lang="ts">
import { dialog } from "@vow/headless";
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import type { SearchItem } from "./index.ts";

// Search (⌘K) — a dialog (vow's own primitive: Esc + tab-trap) with a substring filter over the page +
// heading index. A combobox + listbox: arrow keys move aria-activedescendant, Enter navigates. Restores
// focus + body scroll on close. Closes on overlay click or Esc.
const props = defineProps<{ items: SearchItem[]; open: boolean }>();
const emit = defineEmits<{ "update:open": [boolean] }>();
const query = ref("");
const active = ref(0);
const input = ref<HTMLInputElement>();
let restore: HTMLElement | null = null;

const api = computed(() =>
  dialog({ open: props.open, id: "search" }, (next) => emit("update:open", next.open)),
);
const results = computed<SearchItem[]>(() => {
  const q = query.value.trim().toLowerCase();
  if (q === "") return [];
  return props.items.filter((item) => item.label.toLowerCase().includes(q)).slice(0, 12);
});
const optionId = (index: number): string => `search-opt-${index}`;
const activeId = computed(() => (results.value.length > 0 ? optionId(active.value) : undefined));

watch(
  () => props.open,
  (open) => {
    if (open) {
      restore = document.activeElement as HTMLElement | null;
      query.value = "";
      active.value = 0;
      document.body.style.overflow = "hidden";
      void nextTick(() => input.value?.focus());
    } else {
      document.body.style.overflow = "";
      restore?.focus();
    }
  },
);
watch(results, () => {
  active.value = 0;
});
watch(active, () => {
  void nextTick(() => {
    document.getElementById(activeId.value ?? "")?.scrollIntoView({ block: "nearest" });
  });
});
onBeforeUnmount(() => {
  document.body.style.overflow = "";
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
      <div
        v-bind="api.contentProps"
        class="vow-search__panel"
        aria-label="Search"
        :aria-labelledby="undefined"
        @keydown="onKeydown"
      >
        <input
          ref="input"
          v-model="query"
          class="vow-search__input"
          type="text"
          role="combobox"
          aria-label="Search the docs"
          placeholder="Search the docs"
          aria-autocomplete="list"
          :aria-controls="results.length > 0 ? 'search-listbox' : undefined"
          :aria-expanded="results.length > 0"
          :aria-activedescendant="activeId"
        />
        <ul
          v-if="results.length > 0"
          id="search-listbox"
          class="vow-search__results"
          role="listbox"
        >
          <li v-for="(item, i) in results" :key="item.path">
            <a
              :id="optionId(i)"
              :href="item.path"
              class="vow-search__result"
              role="option"
              tabindex="-1"
              :aria-selected="i === active"
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
        <div class="vow-sr-only" role="status" aria-live="polite">
          {{ query === "" ? "" : results.length > 0 ? `${results.length} results` : "No results" }}
        </div>
      </div>
    </div>
  </Teleport>
</template>
