import {
  ISSUE_LAYOUTS,
  emitIssueBoardSfc,
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
    roadmap: "VowIssueRoadmap",
    table: "VowIssueTable",
  });
});

test("each issue SFC emitter produces a valid, store-bound SFC", () => {
  for (const sfc of [emitIssueTableSfc(), emitIssueBoardSfc(), emitIssueRoadmapSfc()]) {
    expect(sfc).toContain('<script setup lang="ts">');
    expect(sfc).toContain("useIssues");
    expect(sfc).toContain("@vow/store");
    expect(sfc).toContain("</template>");
  }
});

test("each issue SFC emits the close/reopen action button on the shared store seam", () => {
  for (const sfc of [emitIssueTableSfc(), emitIssueBoardSfc(), emitIssueRoadmapSfc()]) {
    expect(sfc).toContain('import Button from "./Button.vue";');
    expect(sfc).toContain("const { items, closeIssue, reopenIssue } = useIssues();");
    expect(sfc).toContain("closeIssue(it.issue.number)");
    expect(sfc).toContain("reopenIssue(it.issue.number)");
    expect(sfc).toContain("it.status === 'done' ? 'Reopen' : 'Close'");
  }
});

test("the changelog timeline groups entries under their version", () => {
  const sfc = emitTimelineSfc([{ date: "2026-06-09", title: "the cli", version: "v0.0.1" }], "");
  expect(sfc).toContain("v0.0.1");
  expect(sfc).toContain("the cli");
});
