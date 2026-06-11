import {
  deriveIssueStatus,
  featureIssueBody,
  linkedIssues,
  parseIssueDetail,
  parseIssues,
  parsePrs,
  statusVariant,
} from "../src/github.ts";
import { expect, test } from "vite-plus/test";
import type { GitHubIssue } from "../src/types.ts";
import { statusOption } from "../src/project.ts";

const ISSUE_A = 56;
const ISSUE_B = 57;
const TWO = 2;

const issue = (over: Partial<GitHubIssue> = {}): GitHubIssue => ({
  assignees: [],
  labels: [],
  number: 1,
  state: "open",
  title: "x",
  ...over,
});

test("parseIssues flattens gh's shape — state lower-cased, labels/assignees to names", () => {
  const json = JSON.stringify([
    {
      assignees: [{ login: "vndredev" }],
      labels: [{ name: "enhancement" }, { name: "area: github" }],
      number: 56,
      state: "OPEN",
      title: "GitHub adapter",
    },
  ]);
  expect(parseIssues(json)).toEqual([
    {
      assignees: ["vndredev"],
      labels: ["enhancement", "area: github"],
      number: 56,
      state: "open",
      title: "GitHub adapter",
    },
  ]);
});

test("parseIssues is graceful — malformed input yields []", () => {
  expect(parseIssues("not json")).toEqual([]);
  expect(parseIssues("{}")).toEqual([]);
});

test("parseIssues survives a malformed array element (no state, bad labels)", () => {
  const json = JSON.stringify([{ number: 5 }, { labels: "nope", title: "x" }]);
  const issues = parseIssues(json);
  expect(issues).toHaveLength(TWO);
  expect(issues[0]).toMatchObject({ labels: [], number: 5, state: "open" });
  expect(issues[1]).toMatchObject({ labels: [], number: 0, title: "x" });
});

test("parseIssues lifts the milestone (title + dueOn) when present, omits it when not", () => {
  const withDue = JSON.stringify([
    {
      assignees: [],
      labels: [],
      milestone: { dueOn: "2026-06-10T00:00:00Z", title: "Phase C" },
      number: 60,
      state: "OPEN",
      title: "Roadmap",
    },
  ]);
  expect(parseIssues(withDue)[0]?.milestone).toEqual({
    dueOn: "2026-06-10T00:00:00Z",
    title: "Phase C",
  });
  const noDue = JSON.stringify([
    {
      assignees: [],
      labels: [],
      milestone: { title: "Phase B" },
      number: 7,
      state: "OPEN",
      title: "y",
    },
  ]);
  // No dueOn -> omitted.
  expect(parseIssues(noDue)[0]?.milestone).toEqual({ title: "Phase B" });
  const noMs = JSON.stringify([
    { assignees: [], labels: [], number: 1, state: "OPEN", title: "x" },
  ]);
  expect(parseIssues(noMs)[0]).not.toHaveProperty("milestone");
});

test("parsePrs keeps number, title, body", () => {
  const json = JSON.stringify([{ body: "Closes #56", number: 9, title: "feat" }]);
  expect(parsePrs(json)).toEqual([{ body: "Closes #56", number: 9, title: "feat" }]);
});

test("linkedIssues lifts every closing keyword, deduped; a bare mention is ignored", () => {
  expect(linkedIssues("Closes #56, fixes #57 and Resolves #56")).toEqual([ISSUE_A, ISSUE_B]);
  expect(linkedIssues("just mentions #99, no keyword")).toEqual([]);
});

test("deriveIssueStatus: closed -> done, open+PR -> doing, open -> planned", () => {
  expect(deriveIssueStatus(issue({ state: "closed" }), [])).toBe("done");
  expect(deriveIssueStatus(issue({ number: ISSUE_A }), [ISSUE_A])).toBe("doing");
  expect(deriveIssueStatus(issue({ number: ISSUE_A }), [])).toBe("planned");
});

test("statusVariant maps to the board's colours", () => {
  expect(statusVariant("planned")).toBe("neutral");
  expect(statusVariant("doing")).toBe("accent");
  expect(statusVariant("done")).toBe("success");
});

test("featureIssueBody fills the feature template — element + why lead, the strand is a footer", () => {
  const body = featureIssueBody({ element: "the GitHub adapter", why: "the plan derives itself" });
  expect(body).toContain("**What** — the GitHub adapter");
  expect(body).toContain("**Why** — the plan derives itself");
  expect(body).toContain("Strand: generation · author layer");
  expect(body).toContain("[plan board](https://github.com/users/vndredev/projects/3)");
});

test("statusOption maps the derived status to the Project's Status options", () => {
  expect(statusOption("planned")).toBe("Todo");
  expect(statusOption("doing")).toBe("In Progress");
  expect(statusOption("done")).toBe("Done");
});

test("parseIssueDetail lifts number, title, body from a gh issue view object", () => {
  const detail = parseIssueDetail(`{"number":${ISSUE_A},"title":"the loop","body":"do it"}`);
  expect(detail).toEqual({ body: "do it", number: ISSUE_A, title: "the loop" });
});

test("parseIssueDetail defaults a missing body and throws on malformed input", () => {
  expect(parseIssueDetail(`{"number":${ISSUE_B},"title":"t"}`).body).toBe("");
  expect(() => parseIssueDetail("nonsense")).toThrow();
});
