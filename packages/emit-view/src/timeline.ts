import type { BadgeVariant, TimelineEntry } from "./types.ts";
import { defined } from "@vow/core";
import { variantForType } from "@vow/observability";

/** One change in a rendered timeline group — its title, optional type/variant chip and PR number. */
interface TimelineItem {
  title: string;
  type?: string;
  variant?: BadgeVariant;
  pr?: number;
}

/** A release group — a version tag, its date and the changes it shipped. */
interface TimelineGroup {
  version: string;
  date: string;
  items: TimelineItem[];
}

/** Build one item from a git entry — the shared type → variant map gives the chip colour. */
function toItem(entry: TimelineEntry): TimelineItem {
  const item: TimelineItem = { title: entry.title };
  if (defined(entry.type)) {
    item.type = entry.type;
    item.variant = variantForType(entry.type);
  }
  if (defined(entry.pr)) {
    item.pr = entry.pr;
  }
  return item;
}

/** Fold the entries into release groups (by version tag, not date — the changelog). */
export function toGroups(entries: readonly TimelineEntry[]): TimelineGroup[] {
  // Group by version into a Map (not just the last group) so interleaved versions still accumulate.
  const byVersion = new Map<string, TimelineGroup>();
  for (const entry of entries) {
    const version = entry.version ?? "Unreleased";
    const group = byVersion.get(version);
    if (defined(group)) {
      group.items.push(toItem(entry));
    } else {
      byVersion.set(version, { date: entry.date, items: [toItem(entry)], version });
    }
  }
  return [...byVersion.values()];
}

const GROUPS_TYPE =
  "{ version: string; date: string; items: { title: string; type?: string; " +
  "variant?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger'; pr?: number }[] }[]";

/** The static `<template>` of the timeline SFC — the data is injected via the `<script>` above it. */
const TIMELINE_TEMPLATE = [
  `<template>`,
  `  <div class="vow-timeline">`,
  `    <Collapsible`,
  `      v-for="(g, gi) in groups"`,
  `      :key="g.version"`,
  `      v-model="open[gi]"`,
  `      :label="g.version + ' · ' + g.date + ' · ' + g.items.length + ' changes'"`,
  `      class="vow-timeline__group"`,
  `    >`,
  `      <ul class="vow-timeline__items">`,
  `        <li v-for="(e, i) in g.items" :key="i" class="vow-timeline__item">`,
  `          <Badge v-if="e.type" :label="e.type" :variant="e.variant" />`,
  `          <span class="vow-timeline__title">{{ e.title }}</span>`,
  `          <a v-if="e.pr && repo" class="vow-timeline__pr" :href="repo + '/pull/' + e.pr">#{{ e.pr }}</a>`,
  `        </li>`,
  `      </ul>`,
  `    </Collapsible>`,
  `  </div>`,
  `</template>`,
  ``,
];

/**
 * The git-derived timeline as a generated SFC — the history baked in at generate time, grouped by date,
 * each date a Collapsible, type Badges + PR links. Shared by @vow/docs (`::: timeline`) and the app
 * generator (a `timeline:` view) — built from `gitTimeline`, vow's own primitives, never hand-typed.
 */
export function emitTimelineSfc(entries: readonly TimelineEntry[], repoUrl?: string): string {
  const groups = toGroups(entries);
  // Each date is a Collapsible — all closed except the most recent (the first group).
  const openFlags = Array.from({ length: groups.length }, (_unused, index) => index === 0);
  const initialOpen = JSON.stringify(openFlags);
  return [
    `<script setup lang="ts">`,
    `// Generated from git — the derived timeline. The history is the source; do not edit.`,
    `import { ref } from "vue";`,
    `import Badge from "./Badge.vue";`,
    `import Collapsible from "./Collapsible.vue";`,
    `const groups: ${GROUPS_TYPE} = ${JSON.stringify(groups)};`,
    `const repo = ${JSON.stringify(repoUrl ?? "")};`,
    `const open = ref<boolean[]>(${initialOpen});`,
    `</script>`,
    ``,
    ...TIMELINE_TEMPLATE,
  ].join("\n");
}
