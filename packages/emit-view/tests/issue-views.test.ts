import {
  ISSUE_LAYOUTS,
  emitIssueBoardSfc,
  emitIssueCompassSfc,
  emitIssueRoadmapSfc,
  emitIssueTableSfc,
  emitTimelineSfc,
  emitView,
  issueLayout,
  issueLayouts,
} from "../src/index.ts";
import { expect, test } from "vite-plus/test";
import type { Vow } from "@vow/core";

/** A view-only vow (a `## view`) with a given node list. */
const view = (nodes: Vow["view"]): Vow => ({
  children: [],
  fields: [],
  fulfills: { as: "view", kind: "emit" },
  id: "vow_v",
  intent: "A page",
  proof: [],
  slug: "page",
  view: nodes,
});

test("issues: { as } renders the layout's component; a missing `as` defaults to table", () => {
  expect(emitView(view([{ type: "issues", value: { as: "board" } }]))).toContain("<VowIssueBoard");
  expect(emitView(view([{ type: "issues", value: { as: "roadmap" } }]))).toContain(
    "<VowIssueRoadmap",
  );
  expect(emitView(view([{ type: "issues", value: { as: "compass" } }]))).toContain(
    "<VowIssueCompass",
  );
  expect(emitView(view([{ type: "issues", value: {} }]))).toContain("<VowIssueTable");
});

test("an unknown issues layout throws — no dangling import to a never-materialised component", () => {
  expect(() => emitView(view([{ type: "issues", value: { as: "cards" } }]))).toThrow(
    /unknown issues layout/u,
  );
  expect(() => issueLayout({ as: "tabel" })).toThrow(/unknown issues layout/u);
});

test("issueLayouts collects the validated layouts a view uses (mapNode + plugin agree)", () => {
  const vow = view([
    { type: "issues", value: { as: "board" } },
    { type: "issues", value: {} },
  ]);
  expect([...issueLayouts(vow)].toSorted()).toEqual(["board", "table"]);
});

test("ISSUE_LAYOUTS maps each layout to its VowIssue* component", () => {
  expect(ISSUE_LAYOUTS).toEqual({
    board: "VowIssueBoard",
    compass: "VowIssueCompass",
    roadmap: "VowIssueRoadmap",
    table: "VowIssueTable",
  });
});

test("each issue SFC emitter produces a valid, store-bound SFC", () => {
  for (const sfc of [
    emitIssueTableSfc(),
    emitIssueBoardSfc(),
    emitIssueRoadmapSfc(),
    emitIssueCompassSfc(),
  ]) {
    expect(sfc).toContain('<script setup lang="ts">');
    expect(sfc).toContain("useIssues");
    expect(sfc).toContain("@vow/store");
    expect(sfc).toContain("</template>");
  }
});

test("each issue SFC emits the close/reopen action button on the shared store seam", () => {
  for (const sfc of [
    emitIssueTableSfc(),
    emitIssueBoardSfc(),
    emitIssueRoadmapSfc(),
    emitIssueCompassSfc(),
  ]) {
    expect(sfc).toContain('import Button from "./Button.vue";');
    expect(sfc).toContain(
      "const { items, state, closeIssue, reopenIssue, startWork } = useIssues();",
    );
    expect(sfc).toContain("closeIssue(it.issue.number)");
    expect(sfc).toContain("reopenIssue(it.issue.number)");
    expect(sfc).toContain("it.status === 'done' ? 'Reopen' : 'Close'");
  }
});

test("each issue SFC emits the start-work button — the human's signal to the agent — on open issues", () => {
  for (const sfc of [
    emitIssueTableSfc(),
    emitIssueBoardSfc(),
    emitIssueRoadmapSfc(),
    emitIssueCompassSfc(),
  ]) {
    // The board action POSTs the start-work signal through the store's `startWork` (-> /__vow/agent).
    expect(sfc).toContain("startWork(it.issue.number)");
    expect(sfc).toContain('label="Start work"');
    // Shown only while not done AND not already running — a live session shows "Watch run", not a second
    // Start-work that would dispatch a duplicate agent onto the same issue.
    expect(sfc).toContain("v-if=\"it.status !== 'done' && !it.session\"");
  }
});

test("each issue SFC shows the layout only when the plan has items (no bare header when empty)", () => {
  for (const sfc of [
    emitIssueTableSfc(),
    emitIssueBoardSfc(),
    emitIssueRoadmapSfc(),
    emitIssueCompassSfc(),
  ]) {
    expect(sfc).toContain('v-if="items.length > 0"');
  }
});

test("each issue SFC carries the loading / error / empty status messages, mutually exclusive", () => {
  for (const sfc of [
    emitIssueTableSfc(),
    emitIssueBoardSfc(),
    emitIssueRoadmapSfc(),
    emitIssueCompassSfc(),
  ]) {
    expect(sfc).toContain('v-if="state.loading && !state.error && items.length === 0"');
    expect(sfc).toContain("Loading the plan");
    expect(sfc).toContain('v-if="state.error && items.length === 0"');
    expect(sfc).toContain("Couldn't reach GitHub");
    expect(sfc).toContain('v-if="!state.loading && !state.error && items.length === 0"');
    // The same friendly empty copy the entity list uses.
    expect(sfc).toContain("Nothing here yet.");
  }
});

test("each issue SFC's status messages are live regions — the swap is announced (WCAG 4.1.3)", () => {
  // Loading/empty are polite (role=status, aria-live=polite); the failure is assertive (role=alert).
  // A screen-reader user hears the load errored instead of being left on a silently-empty plan.
  for (const sfc of [
    emitIssueTableSfc(),
    emitIssueBoardSfc(),
    emitIssueRoadmapSfc(),
    emitIssueCompassSfc(),
  ]) {
    expect(sfc).toContain(
      '<p class="vow-empty" role="status" aria-live="polite" v-if="state.loading && !state.error && items.length === 0">Loading the plan…</p>',
    );
    expect(sfc).toContain(
      '<p class="vow-empty" role="alert" aria-live="assertive" v-if="state.error && items.length === 0">Couldn\'t reach GitHub</p>',
    );
    expect(sfc).toContain(
      '<p class="vow-empty" role="status" aria-live="polite" v-if="!state.loading && !state.error && items.length === 0">Nothing here yet.</p>',
    );
  }
});

test("each issue SFC links the agent session (the open PR) when a doing item carries one", () => {
  for (const sfc of [
    emitIssueTableSfc(),
    emitIssueBoardSfc(),
    emitIssueRoadmapSfc(),
    emitIssueCompassSfc(),
  ]) {
    expect(sfc).toContain('v-if="it.session"');
    expect(sfc).toContain(':href="it.session.url"');
    expect(sfc).toContain("Watch run #{{ it.session.number }}");
    expect(sfc).toContain('target="_blank"');
  }
});

test("the roadmap and board cards lead with the title, then a meta footer with the actions grouped", () => {
  for (const sfc of [emitIssueBoardSfc(), emitIssueRoadmapSfc()]) {
    // The actions (start-work · close/reopen · session) travel as one group, pushed to the trailing edge.
    expect(sfc).toContain('class="vow-issue-actions"');
    // A meta footer carries the number beside the actions, so the card reads title-first.
    expect(sfc).toContain("__meta");
  }
});

test("the roadmap leads each phase with its open work and collapses the done into a shipped disclosure", () => {
  const sfc = emitIssueRoadmapSfc();
  // The open cards lead, shown only when the phase has open work.
  expect(sfc).toContain('v-for="it in p.open"');
  expect(sfc).toContain('v-if="p.open.length > 0"');
  // The done cards collapse into a native <details> "shipped" disclosure (green = proof).
  expect(sfc).toContain("<details");
  expect(sfc).toContain('class="vow-roadmap__shipped"');
  expect(sfc).toContain('v-for="it in p.done"');
  expect(sfc).toContain('v-if="p.done.length > 0"');
  expect(sfc).toContain("shipped");
});

test("the board card carries an issue's labels and assignee, each guarded so an empty card stays clean", () => {
  const sfc = emitIssueBoardSfc();
  // The shared per-label Badge loop, the same the table cell uses.
  expect(sfc).toContain('v-for="l in it.issue.labels"');
  expect(sfc).toContain('v-if="it.issue.labels.length > 0"');
  // The assignee chip mirrors the table's comma-joined cell.
  expect(sfc).toContain('it.issue.assignees.join(", ")');
  expect(sfc).toContain('v-if="it.issue.assignees.length > 0"');
});

test("the changelog timeline groups entries under their version", () => {
  const sfc = emitTimelineSfc([{ date: "2026-06-09", title: "the cli", version: "v0.0.1" }], "");
  expect(sfc).toContain("v0.0.1");
  expect(sfc).toContain("the cli");
});

test("the compass groups the plan by north-star pillar, each with its horizon (the forward lens)", () => {
  const sfc = emitIssueCompassSfc();
  // The four pillars are baked in from the single source (@vow/observability), matched by issue label.
  expect(sfc).toContain('"label":"pillar:describe-to-app"');
  expect(sfc).toContain('"label":"pillar:mechanical-integrity"');
  expect(sfc).toContain("it.issue.labels.includes(p.label)");
  // Each pillar section leads with its title + horizon (a capability toward its end-state, not a date).
  expect(sfc).toContain('class="vow-compass__pillar"');
  expect(sfc).toContain('class="vow-compass__horizon"');
  expect(sfc).toContain('v-for="p in groups"');
});
