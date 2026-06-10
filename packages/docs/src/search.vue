<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { defined, mapDefined } from "@vow/core";
import type { SearchItem } from "./index.ts";
import { dialog } from "@vow/headless";
import { withFocusedElement } from "./dom.ts";

// Search (⌘K) — a dialog (vow's own primitive: Esc + tab-trap) with a substring filter over the page +
// Heading index. A combobox + listbox: arrow keys move aria-activedescendant, Enter navigates. Restores
// Focus + body scroll on close. Closes on overlay click or Esc.
const MAX_RESULTS = 12;
const props = defineProps<{ items: SearchItem[]; open: boolean }>();
const emit = defineEmits<{ "update:open": [boolean] }>();
const query = ref("");
const active = ref(0);
const input = ref<HTMLInputElement>();
const restore = ref<HTMLElement>();

const api = computed(() =>
  dialog({ id: "search", open: props.open }, (next) => {
    emit("update:open", next.open);
  }),
);
const results = computed<SearchItem[]>(() => {
  const term = query.value.trim().toLowerCase();
  if (term === "") {
    return [];
  }
  return props.items
    .filter((item) => item.label.toLowerCase().includes(term))
    .slice(0, MAX_RESULTS);
});
const optionId = (index: number): string => `search-opt-${index}`;
// The active option's id — present only while there is a result under the cursor
const activeId = computed<string | undefined>(() =>
  mapDefined(results.value[active.value], () => optionId(active.value)),
);

watch(
  () => props.open,
  (open) => {
    if (open) {
      withFocusedElement((el) => {
        restore.value = el;
      });
      query.value = "";
      active.value = 0;
      document.body.style.overflow = "hidden";
      nextTick(() => input.value?.focus());
    } else {
      document.body.style.overflow = "";
      restore.value?.focus();
    }
  },
);
watch(results, () => {
  active.value = 0;
});
watch(active, () => {
  nextTick(() => {
    const id = activeId.value;
    if (defined(id)) {
      document.querySelector(`#${id}`)?.scrollIntoView({ block: "nearest" });
    }
  });
});
onBeforeUnmount(() => {
  document.body.style.overflow = "";
});

function go(item: SearchItem | undefined): void {
  if (!defined(item)) {
    return;
  }
  emit("update:open", false);
  globalThis.history.pushState({}, "", item.path);
  globalThis.dispatchEvent(new PopStateEvent("popstate"));
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
