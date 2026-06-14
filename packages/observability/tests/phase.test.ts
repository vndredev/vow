import { currentPhase, milestoneFor, parseMilestones, phaselessIssues } from "../src/phase.ts";
import { expect, test } from "vite-plus/test";
import type { GitHubIssue } from "../src/types.ts";
import { NONE } from "../src/none.ts";

const MILESTONES =
  '[{"title":"Phase H — the hub","dueOn":"2026-06-10T00:00:00Z"},' +
  '{"title":"Phase I — the UI framework","dueOn":"2026-06-16T00:00:00Z"},' +
  '{"title":"Phase G — hardening","dueOn":"2026-06-04T00:00:00Z"}]';

function issue(over: Partial<GitHubIssue>): GitHubIssue {
  return { assignees: [], labels: [], number: 1, state: "open", title: "t", ...over };
}

test("parseMilestones lifts {title, dueOn}, drops a missing dueOn, skips a titleless element", () => {
  const parsed = parseMilestones(
    '[{"title":"A","dueOn":"2026-06-10T00:00:00Z"},{"title":"B"},{"x":1}]',
  );
  expect(parsed).toEqual([{ dueOn: "2026-06-10T00:00:00Z", title: "A" }, { title: "B" }]);
});

test("parseMilestones returns [] on malformed JSON or a non-array", () => {
  expect(parseMilestones("not json")).toEqual([]);
  expect(parseMilestones('{"title":"x"}')).toEqual([]);
});

test("currentPhase picks the milestone with the earliest due date — the next phase in flight", () => {
  expect(currentPhase(parseMilestones(MILESTONES), NONE)).toBe("Phase G — hardening");
});

test("currentPhase honours the VOW_PHASE override over the earliest-due milestone", () => {
  expect(currentPhase(parseMilestones(MILESTONES), "Phase Z — pinned")).toBe("Phase Z — pinned");
});

test("currentPhase is NONE when no dated milestone exists (a milestone-less repo)", () => {
  expect(currentPhase([], NONE)).toBeUndefined();
  expect(currentPhase([{ title: "undated" }], NONE)).toBeUndefined();
});

test("milestoneFor keeps an explicit milestone, else falls back to the resolved phase", () => {
  expect(milestoneFor("Phase H — the hub", "Phase I")).toBe("Phase H — the hub");
  expect(milestoneFor("", "Phase I")).toBe("Phase I");
  expect(milestoneFor(NONE, "Phase I")).toBe("Phase I");
  expect(milestoneFor(NONE, NONE)).toBeUndefined();
});

test("phaselessIssues flags an OPEN issue with no milestone — the gate's red path", () => {
  const phaseless = phaselessIssues([
    issue({ number: 1 }),
    issue({ milestone: { title: "Phase I" }, number: 2 }),
    issue({ number: 3, state: "closed" }),
  ]);
  expect(phaseless.map((found) => found.number)).toEqual([1]);
});

test("phaselessIssues is empty when every open issue carries a phase — the green path", () => {
  expect(
    phaselessIssues([issue({ milestone: { dueOn: "2026-06-16T00:00:00Z", title: "Phase I" } })]),
  ).toEqual([]);
});
