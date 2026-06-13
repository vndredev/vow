// oxlint-disable-next-line consistent-type-specifier-style -- one import; separate type import trips no-duplicate-imports
import { type AttemptCount, autoDecision, backlogOverCap, backlogWithinCap } from "../src/auto.ts";
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

/** The default-empty state with the given overrides — every field present so the decision stays total.
 *  `headChanged` defaults to `true` (new code / no stamp yet) so existing tests cover the audit path. */
function state(
  over: Partial<Parameters<typeof autoDecision>[0]>,
): Parameters<typeof autoDecision>[0] {
  return {
    auditedClean: false,
    backlog: 0,
    capDropped: 0,
    headChanged: true,
    maxRounds: MAX,
    openPrs: 0,
    round: 0,
    ...over,
  };
}

test("autoDecision: below the cap, any effective work develops (the backlog comes first)", () => {
  expect(autoDecision(state({ backlog: SOME }))).toBe("develop");
  expect(autoDecision(state({ backlog: SOME, round: MAX - 1 }))).toBe("develop");
});

test("autoDecision: an open PR is effective work even with an empty backlog (settle can still merge)", () => {
  // No within-cap backlog, but an open PR settle can merge -> the round is NOT a no-op -> develop.
  expect(autoDecision(state({ backlog: 0, openPrs: ONE }))).toBe("develop");
  // An open PR even alongside cap-dropped issues: still develop (settle progresses), never stalled.
  expect(autoDecision(state({ backlog: 0, capDropped: SOME, openPrs: ONE }))).toBe("develop");
});

test("autoDecision: the round cap is an unconditional ceiling — even an open backlog stops", () => {
  // A permanently un-mergeable issue keeps the backlog non-empty forever, so the cap must still fire.
  // Otherwise the loop develops unbounded, burning CI / API quota — the ceiling beats the open backlog.
  expect(autoDecision(state({ backlog: SOME, round: MAX }))).toBe("exhausted");
  expect(autoDecision(state({ backlog: SOME, round: MAX + 1 }))).toBe("exhausted");
});

test("autoDecision: cap-dropped issues with no settleable PR is STALLED, not a no-op spin to the cap", () => {
  // The effective backlog is empty ONLY because every open issue hit the cap, and no PR remains to settle:
  // Every further round is a provable no-op -> stop for a human (stalled), never audit / spin to the cap.
  expect(autoDecision(state({ backlog: 0, capDropped: SOME, openPrs: 0 }))).toBe("stalled");
  // Cap-dropped beats the audit/done branch: a stuck backlog is not "findings-free".
  expect(autoDecision(state({ auditedClean: true, capDropped: SOME }))).toBe("stalled");
});

test("autoDecision: a genuinely empty backlog audits for new work, then powers down once clean", () => {
  // Empty backlog, nothing cap-dropped, HEAD changed, not yet confirmed clean -> audit.
  expect(autoDecision(state({ round: MID }))).toBe("audit");
  // Empty backlog AND a full audit pass found nothing -> done (the self-heal spiral's goal).
  expect(autoDecision(state({ auditedClean: true, round: MID }))).toBe("done");
  // The round cap bounds the audit too — an empty backlog at the cap still stops as exhausted.
  expect(autoDecision(state({ round: MAX }))).toBe("exhausted");
});

test("autoDecision: HEAD unchanged since the clean-audit stamp skips the audit and powers down", () => {
  // HEAD matches the last-clean-audit stamp — the tree is verified clean at this SHA; no Fable spend.
  expect(autoDecision(state({ headChanged: false }))).toBe("done");
  // AuditedClean also reaches done, but headChanged:false alone is enough (both paths are correct).
  expect(autoDecision(state({ auditedClean: true, headChanged: false }))).toBe("done");
  // The round cap is unconditional — it fires even when HEAD is unchanged.
  expect(autoDecision(state({ headChanged: false, round: MAX }))).toBe("exhausted");
  // Cap-dropped beats headChanged:false — a stuck backlog is not "findings-free".
  expect(autoDecision(state({ capDropped: SOME, headChanged: false }))).toBe("stalled");
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

test("backlogOverCap is the complement — exactly the cap-dropped issues a human must unstick", () => {
  const backlog = [ISSUE_A, ISSUE_B, ISSUE_C];
  const attempts: AttemptCount[] = [
    [ISSUE_B, CAP],
    [ISSUE_C, ONE],
  ];
  // Only ISSUE_B (at the cap) is dropped; together with backlogWithinCap it partitions the backlog.
  expect(backlogOverCap(backlog, attempts, CAP)).toEqual([ISSUE_B]);
  expect(backlogOverCap(backlog, [[ISSUE_A, CAP + 1]], CAP)).toEqual([ISSUE_A]);
  expect(backlogOverCap(backlog, [], CAP)).toEqual([]);
});
