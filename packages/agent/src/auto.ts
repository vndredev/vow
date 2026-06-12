/**
 * The brain of `vow agent auto` — the self-heal loop's decision, kept pure (no gh shelling) so it is
 * tested directly. The CLI wraps it: each round lists the open issues, asks `autoDecision`, and either
 * develops + merges another round, audits the codebase for new work, or shuts the system down.
 */

/** The loop's state at the top of a round — how many open issues remain, how many rounds have run, and
 *  whether the last full audit pass came back clean (filed zero findings). */
export interface AutoState {
  readonly auditedClean: boolean;
  readonly openIssues: number;
  readonly round: number;
  readonly maxRounds: number;
}

/** What the loop does next. `develop` = there is work, run another round. `audit` = the backlog is empty
 *  but the codebase has not yet been confirmed findings-free — audit it to generate the next work.
 *  `done` = the backlog is empty AND a full audit pass found nothing (the goal — power down).
 *  `exhausted` = the safety round cap was hit. */
export type AutoOutcome = "audit" | "develop" | "done" | "exhausted";

/** The pure auto-loop decision: the round cap is an UNCONDITIONAL ceiling (checked first) so a permanently
 *  un-mergeable issue — whose drafted PR keeps the backlog non-empty forever — can never spin the loop past
 *  the cap. Below the cap: develop while there is work, else (empty backlog) audit for new findings, and only
 *  when a full audit pass came back clean, power down. The spiral's stop condition: develop -> audit ->
 *  develop -> ... -> done (findings-free), or -> exhausted once the round cap is reached. */
export function autoDecision(state: Readonly<AutoState>): AutoOutcome {
  if (state.round >= state.maxRounds) {
    return "exhausted";
  }
  if (state.openIssues > 0) {
    return "develop";
  }
  if (state.auditedClean) {
    return "done";
  }
  return "audit";
}

/** The default per-issue develop-attempt cap — an issue that fails to produce a mergeable PR this many times
 *  is dropped from the backlog (surfaced for a human) so the rest of the loop keeps progressing. */
export const DEFAULT_ATTEMPT_CAP = 3;

/** One issue's develop-attempt tally so far — `[issue, attempts]`. A readonly-array pair (not a `Map`), since
 *  the strict wall does not treat `ReadonlyMap` as a readonly parameter type. */
export type AttemptCount = readonly [number, number];

/** The backlog issues still WITHIN their per-issue attempt budget: an issue that has already been attempted
 *  `cap` (or more) times without resolving is excluded, so a single permanently-failing issue can't stall the
 *  loop while healthy issues keep going. Pure (the CLI tracks the attempt counts across rounds). */
export function backlogWithinCap(
  backlog: readonly number[],
  attempts: readonly AttemptCount[],
  cap: number,
): number[] {
  const counts = new Map(attempts);
  return backlog.filter((issue) => (counts.get(issue) ?? 0) < cap);
}
