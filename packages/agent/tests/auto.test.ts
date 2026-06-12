import { expect, test } from "vite-plus/test";
import { autoDecision } from "../src/auto.ts";

const MAX = 8;
const SOME = 5;
const MID = 3;

test("autoDecision: any open work develops, regardless of round (the backlog comes first)", () => {
  expect(autoDecision({ auditedClean: false, maxRounds: MAX, openIssues: SOME, round: 0 })).toBe(
    "develop",
  );
  expect(
    autoDecision({ auditedClean: false, maxRounds: MAX, openIssues: SOME, round: MAX - 1 }),
  ).toBe("develop");
  // Even at the round cap, an open backlog still develops — the cap only bounds the empty-backlog audit.
  expect(autoDecision({ auditedClean: false, maxRounds: MAX, openIssues: SOME, round: MAX })).toBe(
    "develop",
  );
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
