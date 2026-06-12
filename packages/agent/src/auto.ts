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

/** The pure auto-loop decision: develop while there is work, stop at the round cap, else (empty backlog)
 *  audit for new findings — and only when a full audit pass came back clean, power down. This is the
 *  self-healing spiral's stop condition: develop -> audit -> develop -> ... -> done (findings-free). */
export function autoDecision(state: Readonly<AutoState>): AutoOutcome {
  if (state.openIssues > 0) {
    return "develop";
  }
  if (state.round >= state.maxRounds) {
    return "exhausted";
  }
  if (state.auditedClean) {
    return "done";
  }
  return "audit";
}
