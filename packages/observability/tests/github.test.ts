import type { GitHubIssue, GitHubPr } from "../src/types.ts";
import {
  IN_PROGRESS_LABEL,
  deriveIssueStatus,
  featureIssueBody,
  linkedIssues,
  parseIssueDetail,
  parseIssues,
  parseLabels,
  parsePrs,
  sessionsByIssue,
  statusVariant,
} from "../src/github.ts";
import { expect, test } from "vite-plus/test";
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

test("parsePrs keeps number, title, body, url, isDraft (defaulting a missing url/isDraft)", () => {
  const json = JSON.stringify([
    {
      body: "Closes #56",
      isDraft: true,
      number: 9,
      title: "feat",
      url: "https://github.com/o/r/pull/9",
    },
  ]);
  expect(parsePrs(json)).toEqual([
    {
      body: "Closes #56",
      isDraft: true,
      number: 9,
      title: "feat",
      url: "https://github.com/o/r/pull/9",
    },
  ]);
  expect(parsePrs(JSON.stringify([{ body: "x", number: 1, title: "t" }]))[0]?.url).toBe("");
  // A missing isDraft reads as a ready PR (false), never undefined.
  expect(parsePrs(JSON.stringify([{ body: "x", number: 1, title: "t" }]))[0]?.isDraft).toBe(false);
});

test("parsePrs survives a malformed element — missing number/title default, never undefined", () => {
  // A payload missing the (non-optional) number/title must not become an undefined pair typed as a PR.
  // The PR path re-validates like the issue path, not trusting the predicate.
  const prs = parsePrs(JSON.stringify([{ body: "Closes #5" }]));
  expect(prs).toEqual([{ body: "Closes #5", isDraft: false, number: 0, title: "", url: "" }]);
});

test("linkedIssues lifts every closing keyword, deduped; a bare mention is ignored", () => {
  expect(linkedIssues("Closes #56, fixes #57 and Resolves #56")).toEqual([ISSUE_A, ISSUE_B]);
  expect(linkedIssues("just mentions #99, no keyword")).toEqual([]);
});

const pr = (over: Partial<GitHubPr> = {}): GitHubPr => ({
  body: "",
  isDraft: false,
  number: 1,
  title: "t",
  url: "",
  ...over,
});

const FIRST_PR = 9;
const SECOND_PR = 10;
const MENTIONED = 99;

test("sessionsByIssue maps each closed issue to its open PR's number + url; the first PR wins", () => {
  const firstSession = { number: FIRST_PR, url: "https://gh/pull/9" };
  const prs = [
    pr({ body: `Closes #${ISSUE_A}, fixes #${ISSUE_B}`, number: FIRST_PR, url: firstSession.url }),
    pr({ body: `Closes #${ISSUE_A}`, number: SECOND_PR, url: "https://gh/pull/10" }),
  ];
  const sessions = sessionsByIssue(prs);
  expect(sessions.get(ISSUE_A)).toEqual(firstSession);
  expect(sessions.get(ISSUE_B)).toEqual(firstSession);
  // The first PR claiming #56 wins — PR 10 does not overwrite it.
  expect(sessions.get(ISSUE_A)?.number).toBe(FIRST_PR);
  // A bare mention (no closing keyword) is not a session.
  expect(sessionsByIssue([pr({ body: `see #${MENTIONED}` })]).has(MENTIONED)).toBe(false);
});

test("sessionsByIssue skips a DRAFT PR — a stalled run never marks its issue doing (#521 stuck-board fix)", () => {
  // A draft PR closing #56 is a red develop run parked for a human, not an active session — no session.
  // Its issue then derives as planned (awaiting a fresh attempt), not pinned "In Progress" forever.
  const draftClosing = [pr({ body: `Closes #${ISSUE_A}`, isDraft: true, number: FIRST_PR })];
  expect(sessionsByIssue(draftClosing).has(ISSUE_A)).toBe(false);
  const closing = [...sessionsByIssue(draftClosing).keys()];
  expect(deriveIssueStatus(issue({ number: ISSUE_A }), closing)).toBe("planned");
  // A READY PR closing the same issue still claims it — the live develop -> merge arc is unaffected.
  expect(sessionsByIssue([pr({ body: `Closes #${ISSUE_A}`, number: FIRST_PR })]).has(ISSUE_A)).toBe(
    true,
  );
});

test("deriveIssueStatus: closed -> done, open+PR -> doing, open -> planned", () => {
  expect(deriveIssueStatus(issue({ state: "closed" }), [])).toBe("done");
  expect(deriveIssueStatus(issue({ number: ISSUE_A }), [ISSUE_A])).toBe("doing");
  expect(deriveIssueStatus(issue({ number: ISSUE_A }), [])).toBe("planned");
});

test("deriveIssueStatus: the in-progress label reads as doing before any PR exists (#479)", () => {
  // An agent claims the issue (label) the moment it starts developing — doing without an open PR yet.
  expect(deriveIssueStatus(issue({ labels: [IN_PROGRESS_LABEL] }), [])).toBe("doing");
  // The label is moot once the issue closes — done still wins.
  expect(deriveIssueStatus(issue({ labels: [IN_PROGRESS_LABEL], state: "closed" }), [])).toBe(
    "done",
  );
  // An ordinary label is not the claim signal — still planned.
  expect(deriveIssueStatus(issue({ labels: ["area: agent"] }), [])).toBe("planned");
});

test("statusVariant maps to the board's colours", () => {
  expect(statusVariant("planned")).toBe("neutral");
  expect(statusVariant("doing")).toBe("accent");
  expect(statusVariant("done")).toBe("success");
});

test("featureIssueBody fills the feature template — element + why lead, the strand is a footer", () => {
  const body = featureIssueBody({ element: "the GitHub adapter", why: "the plan derives itself" });
  expect(body).toContain("**What**\n\nthe GitHub adapter");
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

test("parseLabels takes gh's --jq label lines, dropping empties", () => {
  expect(parseLabels("enhancement\narea: emit\n")).toEqual(["enhancement", "area: emit"]);
  expect(parseLabels("")).toEqual([]);
});
