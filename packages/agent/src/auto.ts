/**
 * The brain of `vow agent auto` — the self-heal loop's decision, kept pure (no gh shelling) so it is
 * tested directly. The CLI wraps it: each round lists the open issues, asks `autoDecision`, and either
 * develops + merges another round or shuts the system down.
 */

/** The loop's state at the top of a round — how many open issues remain + how many rounds have run. */
export interface AutoState {
  readonly openIssues: number;
  readonly round: number;
  readonly maxRounds: number;
}

/** What the loop does next. `done` = the backlog is empty (the goal — keep going until findings-free, then
 *  power down). `exhausted` = the safety round cap was hit. `develop` = there is work, run another round. */
export type AutoOutcome = "develop" | "done" | "exhausted";

/** The pure auto-loop decision: shut down on an empty backlog, stop at the round cap, else develop. */
export function autoDecision(state: Readonly<AutoState>): AutoOutcome {
  if (state.openIssues === 0) {
    return "done";
  }
  if (state.round >= state.maxRounds) {
    return "exhausted";
  }
  return "develop";
}
