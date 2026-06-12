// oxlint-disable-next-line consistent-type-specifier-style -- one import; separate type import trips no-duplicate-imports
import { type AttemptCount, autoDecision, backlogWithinCap } from "../src/auto.ts";
import { expect, test } from "vite-plus/test";

const MAX = 8;
const SOME = 5;
const MID = 3;
const CAP = 3;
// Three illustrative issue numbers for the backlog (any distinct positive ids work).
const ISSUE_A = 11;
const ISSUE_B = 22;
const ISSUE_C = 33;
const ONE = 1;

test("autoDecision: below the cap, any open work develops (the backlog comes first)", () => {
  expect(autoDecision({ auditedClean: false, maxRounds: MAX, openIssues: SOME, round: 0 })).toBe(
    "develop",
  );
  expect(
    autoDecision({ auditedClean: false, maxRounds: MAX, openIssues: SOME, round: MAX - 1 }),
  ).toBe("develop");
});

test("autoDecision: the round cap is an unconditional ceiling — even an open backlog stops", () => {
  // A permanently un-mergeable issue keeps the backlog non-empty forever, so the cap must still fire.
  // Otherwise the loop develops unbounded, burning CI / API quota — the ceiling beats the open backlog.
  expect(autoDecision({ auditedClean: false, maxRounds: MAX, openIssues: SOME, round: MAX })).toBe(
    "exhausted",
  );
  expect(
    autoDecision({ auditedClean: false, maxRounds: MAX, openIssues: SOME, round: MAX + 1 }),
  ).toBe("exhausted");
});

test("autoDecision: an empty backlog audits for new work, then powers down once clean", () => {
  // Empty backlog, not yet confirmed clean -> audit to generate the next work.
  expect(autoDecision({ auditedClean: false, maxRounds: MAX, openIssues: 0, round: MID })).toBe(
    "audit",
  );
  // Empty backlog AND a full audit pass found nothing -> done (the self-heal spiral's goal).
  expect(autoDecision({ auditedClean: true, maxRounds: MAX, openIssues: 0, round: MID })).toBe(
    "done",
  );
  // The round cap bounds the audit too — an empty backlog at the cap still stops as exhausted.
  expect(autoDecision({ auditedClean: false, maxRounds: MAX, openIssues: 0, round: MAX })).toBe(
    "exhausted",
  );
});

test("backlogWithinCap drops an issue at/over its attempt cap, keeps healthy ones progressing", () => {
  const backlog = [ISSUE_A, ISSUE_B, ISSUE_C];
  // ISSUE_B has failed CAP times -> excluded; ISSUE_A (untried) + ISSUE_C (one prior attempt) stay.
  const attempts: AttemptCount[] = [
    [ISSUE_B, CAP],
    [ISSUE_C, ONE],
  ];
  expect(backlogWithinCap(backlog, attempts, CAP)).toEqual([ISSUE_A, ISSUE_C]);
  // Over the cap is excluded too; an empty attempt list keeps everything.
  expect(backlogWithinCap(backlog, [[ISSUE_A, CAP + 1]], CAP)).toEqual([ISSUE_B, ISSUE_C]);
  expect(backlogWithinCap(backlog, [], CAP)).toEqual([ISSUE_A, ISSUE_B, ISSUE_C]);
});
