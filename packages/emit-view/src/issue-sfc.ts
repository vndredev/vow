/**
 * The three live issue-plan SFCs (`useIssues`, gh-direct) — table, board and roadmap. Each is a fixed
 * component the plugin materialises (`map-node.ts`'s `issues:` node points at one). They share the
 * status → Badge-variant lines below and read `/__vow/issues` live (no baked data, unlike the timeline).
 */

/**
 * The status → Badge-variant lines the three issue SFCs share (mirrors @vow/observability's
 * STATUS_VARIANT; the SFCs run in the browser, so they inline it rather than import the node helper).
 * One source — change the mapping here, all three layouts follow.
 */
const ISSUE_VARIANT_LINES = [
  `const variant = (s: string): "neutral" | "accent" | "success" =>`,
  `  s === "done" ? "success" : s === "doing" ? "accent" : "neutral";`,
];

/**
 * The close/reopen action button the three issue layouts share — `Reopen` when the issue is done (closed),
 * else `Close`, keyed off the live `it.status`. It calls `closeIssue`/`reopenIssue` from `useIssues`, which
 * POST through the same dev seam the agent's MCP `close_issue` uses — one path to GitHub for user + agent.
 */
const ISSUE_ACTION_BUTTON =
  `<Button :label="it.status === 'done' ? 'Reopen' : 'Close'"` +
  ` @click="it.status === 'done' ? reopenIssue(it.issue.number) : closeIssue(it.issue.number)" />`;

const TABLE_TEMPLATE = [
  `<template>`,
  `  <table class="vow-table vow-issue-table">`,
  `    <thead>`,
  `      <tr>`,
  `        <th class="vow-table__head">#</th>`,
  `        <th class="vow-table__head">Title</th>`,
  `        <th class="vow-table__head">Status</th>`,
  `        <th class="vow-table__head">Labels</th>`,
  `        <th class="vow-table__head">Assignee</th>`,
  `        <th class="vow-table__head">Actions</th>`,
  `      </tr>`,
  `    </thead>`,
  `    <tbody>`,
  `      <tr v-for="it in items" :key="it.issue.number" class="vow-table__row">`,
  `        <td class="vow-table__cell vow-issue-table__num">{{ it.issue.number }}</td>`,
  `        <td class="vow-table__cell">{{ it.issue.title }}</td>`,
  `        <td class="vow-table__cell"><Badge :label="it.status" :variant="variant(it.status)" /></td>`,
  `        <td class="vow-table__cell vow-issue-table__labels">`,
  `          <Badge v-for="l in it.issue.labels" :key="l" :label="l" variant="neutral" />`,
  `        </td>`,
  `        <td class="vow-table__cell">{{ it.issue.assignees.join(", ") }}</td>`,
  `        <td class="vow-table__cell">${ISSUE_ACTION_BUTTON}</td>`,
  `      </tr>`,
  `    </tbody>`,
  `  </table>`,
  `</template>`,
  ``,
];

/**
 * The issue-table component — a fixed `<VowIssueTable>` reading the live issue plan (`useIssues`,
 * gh-direct). No baked data (unlike the timeline): it fetches `/__vow/issues` and polls. Mirrors a
 * GitHub Projects Table view: number · title · status · labels · assignee.
 */
export function emitIssueTableSfc(): string {
  return [
    `<script setup lang="ts">`,
    `// Generated — the GitHub issue plan as a table, read live from /__vow/issues. Do not edit.`,
    `import { useIssues } from "@vow/store";`,
    `import Badge from "./Badge.vue";`,
    `import Button from "./Button.vue";`,
    ``,
    `const { items, closeIssue, reopenIssue } = useIssues();`,
    ...ISSUE_VARIANT_LINES,
    `</script>`,
    ``,
    ...TABLE_TEMPLATE,
  ].join("\n");
}

const BOARD_TEMPLATE = [
  `<template>`,
  `  <div class="vow-board vow-issue-board">`,
  `    <div v-for="col in grouped" :key="col.status" class="vow-board__col">`,
  `      <div class="vow-board__col-head">`,
  `        <Badge :label="col.status" :variant="variant(col.status)" />`,
  `        <span class="vow-board__count">{{ col.items.length }}</span>`,
  `      </div>`,
  `      <article v-for="it in col.items" :key="it.issue.number" class="vow-board__card">`,
  `        <span class="vow-issue-board__num">#{{ it.issue.number }}</span>`,
  `        <span class="vow-issue-board__title">{{ it.issue.title }}</span>`,
  `        ${ISSUE_ACTION_BUTTON}`,
  `      </article>`,
  `    </div>`,
  `  </div>`,
  `</template>`,
  ``,
];

/**
 * The issue-board component — a fixed `<VowIssueBoard>` reading the live issue plan (`useIssues`,
 * gh-direct) as a kanban by derived status. Mirrors a GitHub Projects Board view; reuses the entity
 * board's look (`.vow-board`).
 */
export function emitIssueBoardSfc(): string {
  return [
    `<script setup lang="ts">`,
    `// Generated — the GitHub issue plan as a board, read live from /__vow/issues. Do not edit.`,
    `import { computed } from "vue";`,
    `import { useIssues } from "@vow/store";`,
    `import Badge from "./Badge.vue";`,
    `import Button from "./Button.vue";`,
    ``,
    `const { items, closeIssue, reopenIssue } = useIssues();`,
    `const columns = ["planned", "doing", "done"] as const;`,
    ...ISSUE_VARIANT_LINES,
    `const grouped = computed(() =>`,
    `  columns.map((c) => ({ status: c, items: items.filter((it) => it.status === c) })),`,
    `);`,
    `</script>`,
    ``,
    ...BOARD_TEMPLATE,
  ].join("\n");
}

const ROADMAP_SCRIPT = [
  `const { items, closeIssue, reopenIssue } = useIssues();`,
  ...ISSUE_VARIANT_LINES,
  `interface Phase { title: string; due: string; dueAt: number; items: IssueItem[] }`,
  `const phases = computed(() => {`,
  `  const by = new Map<string, Phase>();`,
  `  for (const it of items) {`,
  `    const m = it.issue.milestone;`,
  `    const title = m?.title ?? "No milestone";`,
  `    let phase = by.get(title);`,
  `    if (phase === undefined) {`,
  `      const dueOn = m?.dueOn ?? "";`,
  `      const dueAt = dueOn ? Date.parse(dueOn) : Number.POSITIVE_INFINITY; // undated phases sort last`,
  `      phase = { title, due: dueOn.slice(0, 10), dueAt, items: [] };`,
  `      by.set(title, phase);`,
  `    }`,
  `    phase.items.push(it);`,
  `  }`,
  `  return [...by.values()].sort((a, b) => a.dueAt - b.dueAt); // earliest phase first`,
  `});`,
];

const ROADMAP_TEMPLATE = [
  `<template>`,
  `  <div class="vow-roadmap">`,
  `    <section v-for="p in phases" :key="p.title" class="vow-roadmap__phase">`,
  `      <header class="vow-roadmap__head">`,
  `        <h3 class="vow-roadmap__milestone">{{ p.title }}</h3>`,
  `        <span v-if="p.due" class="vow-roadmap__due">{{ p.due }}</span>`,
  `      </header>`,
  `      <ul class="vow-roadmap__items">`,
  `        <li v-for="it in p.items" :key="it.issue.number" class="vow-roadmap__item">`,
  `          <div class="vow-roadmap__meta">`,
  `            <span class="vow-roadmap__num">#{{ it.issue.number }}</span>`,
  `            <Badge :label="it.status" :variant="variant(it.status)" />`,
  `            ${ISSUE_ACTION_BUTTON}`,
  `          </div>`,
  `          <span class="vow-roadmap__title">{{ it.issue.title }}</span>`,
  `        </li>`,
  `      </ul>`,
  `    </section>`,
  `  </div>`,
  `</template>`,
  ``,
];

/**
 * The issue-roadmap component — a fixed `<VowIssueRoadmap>` reading the live issue plan (`useIssues`,
 * gh-direct), grouped by **milestone** (the roadmap's phases). Mirrors a GitHub Projects Roadmap view.
 */
export function emitIssueRoadmapSfc(): string {
  return [
    `<script setup lang="ts">`,
    `// Generated — the GitHub issue plan as a roadmap: phases (milestones) on a timeline by due date. Do not edit.`,
    `import { computed } from "vue";`,
    `import { type IssueItem, useIssues } from "@vow/store";`,
    `import Badge from "./Badge.vue";`,
    `import Button from "./Button.vue";`,
    ``,
    ...ROADMAP_SCRIPT,
    `</script>`,
    ``,
    ...ROADMAP_TEMPLATE,
  ].join("\n");
}
