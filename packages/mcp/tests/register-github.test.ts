// @vitest-environment node
import { expect, test } from "vite-plus/test";
import { AddIssue } from "../src/register-github.ts";
import { z } from "zod";

/*
 * `add_issue` opens a GitHub issue from the feature template; its pillar + phase now live on the local
 * `@vow/plan` item (`sync_plan` ingests the issue), not a routed GitHub label/milestone or a Project. These
 * pin the surviving schema: the optional toolkit extras (assignee, labels) parse, and the retired Project
 * fields (`milestone`, `project`) are gone.
 */

test("add_issue's schema accepts the feature fields + the optional assignee/labels", () => {
  const parsed = z.object(AddIssue).safeParse({
    assignee: "vndredev",
    element: "An element",
    labels: ["area: mcp"],
    title: "A title",
    why: "A reason",
  });
  expect(parsed.success).toBe(true);
});

test("add_issue's optional extras may all be omitted — the minimal issue still parses", () => {
  const parsed = z.object(AddIssue).safeParse({
    element: "An element",
    title: "A title",
    why: "A reason",
  });
  expect(parsed.success).toBe(true);
});

test("add_issue no longer carries the retired Project/milestone fields", () => {
  expect("milestone" in AddIssue).toBe(false);
  expect("project" in AddIssue).toBe(false);
});
