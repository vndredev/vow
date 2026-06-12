import { BADGE_VARIANTS, unionType } from "@vow/theme";
import type { BadgeVariant, Component, TimelineEntry, UiNode } from "./types.ts";
import { defined } from "@vow/core";
import { renderVueSfc } from "@vow/component";
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
  `variant?: ${unionType(BADGE_VARIANTS)}; pr?: number }[] }[]`;

/** The type Badge of a timeline item — only present when the entry carries a `type`. */
function typeBadge(): UiNode {
  return {
    attrs: [
      { expr: "e.type", kind: "cond", type: "if" },
      { expr: "e.type", kind: "bound", name: "label" },
      { expr: "e.variant", kind: "bound", name: "tone" },
    ],
    children: [],
    kind: "component",
    name: "Badge",
  };
}

/** The PR link of a timeline item — only present when the entry has a PR and a repo is known. */
function prLink(): UiNode {
  return {
    attrs: [
      { expr: "e.pr && repo", kind: "cond", type: "if" },
      { kind: "static", name: "class", value: "vow-timeline__pr" },
      { expr: "repo + '/pull/' + e.pr", kind: "bound", name: "href" },
    ],
    children: [
      { kind: "text", text: "#" },
      { expr: "e.pr", kind: "interp" },
    ],
    kind: "element",
    tag: "a",
  };
}

/** One change `<li>` in a group — its optional type Badge, its title and its optional PR link. */
function timelineItem(): UiNode {
  return {
    attrs: [{ kind: "static", name: "class", value: "vow-timeline__item" }],
    children: [
      typeBadge(),
      {
        attrs: [{ kind: "static", name: "class", value: "vow-timeline__title" }],
        children: [{ expr: "e.title", kind: "interp" }],
        kind: "element",
        tag: "span",
      },
      prLink(),
    ],
    for: { as: "e", each: "g.items", index: "i", key: "i" },
    kind: "element",
    tag: "li",
  };
}

/** One release group — a Collapsible (v-model-bound open flag) wrapping its change list. */
function timelineGroup(): UiNode {
  return {
    attrs: [
      { kind: "static", name: "class", value: "vow-timeline__group" },
      { expr: "open[gi]", kind: "model" },
      {
        expr:
          `g.version + ' · ' + g.date + ' · ' + g.items.length + ` +
          `(g.items.length === 1 ? ' change' : ' changes')`,
        kind: "bound",
        name: "label",
      },
    ],
    children: [
      {
        attrs: [{ kind: "static", name: "class", value: "vow-timeline__items" }],
        children: [timelineItem()],
        kind: "element",
        tag: "ul",
      },
    ],
    for: { as: "g", each: "groups", index: "gi", key: "g.version" },
    kind: "component",
    name: "Collapsible",
  };
}

/** The timeline view tree — a `<div>` holding a Collapsible per release group. */
function timelineView(): UiNode {
  return {
    attrs: [{ kind: "static", name: "class", value: "vow-timeline" }],
    children: [timelineGroup()],
    kind: "element",
    tag: "div",
  };
}

/**
 * The git-derived timeline as a generated SFC — the history baked in at generate time, grouped by date,
 * each date a Collapsible, type Badges + PR links. Shared by @vow/docs (`::: timeline`) and the app
 * generator (a `timeline:` view) — built from `gitTimeline`, vow's own primitives, never hand-typed.
 * A canonical `Component` rendered through @vow/component — framework-neutral, never raw Vue.
 */
export function emitTimelineSfc(entries: readonly TimelineEntry[], repoUrl?: string): string {
  const groups = toGroups(entries);
  // Each date is a Collapsible — all closed except the most recent (the first group).
  const openFlags = Array.from({ length: groups.length }, (_unused, index) => index === 0);
  const component: Component = {
    doc: ["Generated from git — the derived timeline. The history is the source; do not edit."],
    imports: [
      { from: "vue", names: ["ref"] },
      { default: "Badge", from: "./Badge.vue" },
      { default: "Collapsible", from: "./Collapsible.vue" },
    ],
    name: "VowTimeline",
    setup: [
      `const groups: ${GROUPS_TYPE} = ${JSON.stringify(groups)};`,
      `const repo = ${JSON.stringify(repoUrl ?? "")};`,
      `const open = ref<boolean[]>(${JSON.stringify(openFlags)});`,
    ],
    view: timelineView(),
  };
  return renderVueSfc(component);
}
