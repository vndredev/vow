import { expect, test } from "vite-plus/test";
import {
  deriveIssueStatus,
  featureIssueBody,
  type GitHubIssue,
  linkedIssues,
  parseIssues,
  parsePrs,
  statusOption,
  statusVariant,
} from "../src/github.ts";

const issue = (over: Partial<GitHubIssue> = {}): GitHubIssue => ({
  number: 1,
  title: "x",
  state: "open",
  labels: [],
  assignees: [],
  ...over,
});

test("parseIssues flattens gh's shape — state lower-cased, labels/assignees to names", () => {
  const json = JSON.stringify([
    {
      number: 56,
      title: "GitHub adapter",
      state: "OPEN",
      labels: [{ name: "enhancement" }, { name: "area: github" }],
      assignees: [{ login: "vndredev" }],
    },
  ]);
  expect(parseIssues(json)).toEqual([
    {
      number: 56,
      title: "GitHub adapter",
      state: "open",
      labels: ["enhancement", "area: github"],
      assignees: ["vndredev"],
    },
  ]);
});

test("parseIssues is graceful — malformed input yields []", () => {
  expect(parseIssues("not json")).toEqual([]);
  expect(parseIssues("{}")).toEqual([]);
});

test("parsePrs keeps number, title, body", () => {
  const json = JSON.stringify([{ number: 9, title: "feat", body: "Closes #56" }]);
  expect(parsePrs(json)).toEqual([{ number: 9, title: "feat", body: "Closes #56" }]);
});

test("linkedIssues lifts every closing keyword, deduped; a bare mention is ignored", () => {
  expect(linkedIssues("Closes #56, fixes #57 and Resolves #56")).toEqual([56, 57]);
  expect(linkedIssues("just mentions #99, no keyword")).toEqual([]);
});

test("deriveIssueStatus: closed -> done, open+PR -> doing, open -> planned", () => {
  expect(deriveIssueStatus(issue({ state: "closed" }), new Set())).toBe("done");
  expect(deriveIssueStatus(issue({ number: 56 }), new Set([56]))).toBe("doing");
  expect(deriveIssueStatus(issue({ number: 56 }), new Set())).toBe("planned");
});

test("statusVariant maps to the board's colours", () => {
  expect(statusVariant("planned")).toBe("neutral");
  expect(statusVariant("doing")).toBe("accent");
  expect(statusVariant("done")).toBe("success");
});

test("featureIssueBody fills the feature template's three sections", () => {
  const body = featureIssueBody({ element: "the GitHub adapter", why: "the plan derives itself" });
  expect(body).toContain("**Strand / roadmap item**");
  expect(body).toContain("**The element / function** — the GitHub adapter");
  expect(body).toContain("**Why** — the plan derives itself");
});

test("statusOption maps the derived status to the Project's Status options", () => {
  expect(statusOption("planned")).toBe("Todo");
  expect(statusOption("doing")).toBe("In Progress");
  expect(statusOption("done")).toBe("Done");
});
