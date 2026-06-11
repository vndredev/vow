import type { GitHubIssue, GitHubPr } from "../src/types.ts";
import { expect, test } from "vite-plus/test";
import { linkedIssues, staleIssues } from "../src/github.ts";

// Issue / PR numbers as named constants (the wall forbids bare numeric literals).
const FIRST = 111;
const SECOND = 112;
const FIX = 3;
const RESOLVE = 9;
const OTHER = 200;
const PR = 120;

test("linkedIssues catches a comma-separated close list (the one GitHub's auto-close misses)", () => {
  expect(linkedIssues(`Closes #${FIRST}, #${SECOND}.`)).toEqual([FIRST, SECOND]);
  expect(linkedIssues(`Fixes #${FIX} and resolves #${RESOLVE}`)).toEqual([FIX, RESOLVE]);
  expect(linkedIssues("no link here")).toEqual([]);
});

test("staleIssues finds the open issues a merged PR already closes", () => {
  const open: GitHubIssue[] = [
    { assignees: [], labels: [], number: SECOND, state: "open", title: "no-orphan gate" },
    { assignees: [], labels: [], number: OTHER, state: "open", title: "unrelated" },
  ];
  const merged: GitHubPr[] = [
    { body: `Closes #${FIRST}, #${SECOND}.`, number: PR, title: "ci gates", url: "" },
  ];
  expect(staleIssues(open, merged).map((issue) => issue.number)).toEqual([SECOND]);
});
