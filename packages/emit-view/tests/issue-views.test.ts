import { expect, test } from "vite-plus/test";
import { type Vow } from "@vow/core";
import {
  emitIssueBoardSfc,
  emitIssueRoadmapSfc,
  emitIssueTableSfc,
  emitTimelineSfc,
  emitView,
  ISSUE_LAYOUTS,
  issueLayout,
  issueLayouts,
} from "../src/index.ts";

/** A view-only vow (a `## view`) with a given node list. */
const view = (nodes: Vow["view"]): Vow => ({
  id: "vow_v",
  slug: "page",
  intent: "A page",
  children: [],
  fields: [],
  proof: [],
  fulfills: { kind: "emit", as: "view" },
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
    /unknown issues layout/,
  );
  expect(() => issueLayout({ as: "tabel" })).toThrow(/unknown issues layout/);
});

test("issueLayouts collects the validated layouts a view uses (mapNode + plugin agree)", () => {
  const v = view([
    { type: "issues", value: { as: "board" } },
    { type: "issues", value: {} },
  ]);
  expect([...issueLayouts(v)].sort()).toEqual(["board", "table"]);
});

test("ISSUE_LAYOUTS maps each layout to its VowIssue* component", () => {
  expect(ISSUE_LAYOUTS).toEqual({
    table: "VowIssueTable",
    board: "VowIssueBoard",
    roadmap: "VowIssueRoadmap",
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

test("the changelog timeline groups entries under their version", () => {
  const sfc = emitTimelineSfc([{ date: "2026-06-09", title: "the cli", version: "v0.0.1" }], "");
  expect(sfc).toContain("v0.0.1");
  expect(sfc).toContain("the cli");
});
