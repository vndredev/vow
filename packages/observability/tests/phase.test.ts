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

// A fixed today, so the date-guarded resolution is deterministic (the clock is injected, never read here).
const TODAY = "2026-06-15";

// A stale never-closed early milestone (the #718 sink) next to a genuine upcoming one.
const STALE_AND_AHEAD =
  '[{"title":"Phase A — the spec-driven generator","dueOn":"2026-05-07T00:00:00Z"},' +
  '{"title":"Phase K — the autonomy cockpit","dueOn":"2026-06-26T00:00:00Z"}]';

test("currentPhase picks the earliest milestone still ahead — the next phase in flight", () => {
  // Today before all three: the earliest-due (G) is the next in flight.
  expect(currentPhase(parseMilestones(MILESTONES), NONE, "2026-06-01")).toBe("Phase G — hardening");
});

test("currentPhase skips a stale never-closed milestone, picks the next ahead (#718 — no sink)", () => {
  // The overdue "Phase A" must NOT capture new work while a later phase is still ahead.
  expect(currentPhase(parseMilestones(STALE_AND_AHEAD), NONE, TODAY)).toBe(
    "Phase K — the autonomy cockpit",
  );
});

test("currentPhase counts a milestone due today as in flight, not already past", () => {
  const dueToday =
    '[{"title":"Phase X","dueOn":"2026-06-15T00:00:00Z"},{"title":"Phase W","dueOn":"2026-05-01T00:00:00Z"}]';
  expect(currentPhase(parseMilestones(dueToday), NONE, TODAY)).toBe("Phase X");
});

test("currentPhase falls back to the most-recent past milestone when none lie ahead — never phase-less", () => {
  // Every milestone overdue: the latest past one (I, due 06-16) still phases the issue.
  expect(currentPhase(parseMilestones(MILESTONES), NONE, "2026-07-01")).toBe(
    "Phase I — the UI framework",
  );
});

test("currentPhase honours the VOW_PHASE override over the date-guarded milestone", () => {
  expect(currentPhase(parseMilestones(MILESTONES), "Phase Z — pinned", TODAY)).toBe(
    "Phase Z — pinned",
  );
});

test("currentPhase is NONE when no dated milestone exists (a milestone-less repo)", () => {
  expect(currentPhase([], NONE, TODAY)).toBeUndefined();
  expect(currentPhase([{ title: "undated" }], NONE, TODAY)).toBeUndefined();
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
