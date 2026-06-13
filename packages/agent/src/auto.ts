/**
 * The brain of `vow agent auto` — the self-heal loop's decision, kept pure (no gh shelling) so it is
 * tested directly. The CLI wraps it: each round lists the open issues, asks `autoDecision`, and either
 * develops + merges another round, audits the codebase for new work, or shuts the system down.
 */

/** The loop's state at the top of a round — the EFFECTIVE workload, not the raw open count: `backlog` is the
 *  cap-filtered set the round will actually develop, `capDropped` how many open issues the attempt cap
 *  excluded (issues still open but stuck), and `openPrs` how many PRs settle can still merge (so a round with
 *  open PRs is never a no-op). Plus how many rounds have run, whether the last full audit pass came back
 *  clean (filed zero findings), and `headChanged` — whether HEAD has moved since the last findings-free audit
 *  SHA was stamped (true when no stamp exists; false = the tree is verified clean at this SHA, skip audit).
 *  Feeding the decision the EFFECTIVE backlog — not the raw open count — is what keeps a cap-dropped issue
 *  from making every remaining round a guaranteed no-op that spins to the cap. */
export interface AutoState {
  readonly auditedClean: boolean;
  readonly backlog: number;
  readonly capDropped: number;
  readonly headChanged: boolean;
  readonly openPrs: number;
  readonly round: number;
  readonly maxRounds: number;
}

/** What the loop does next. `develop` = there is work, run another round. `audit` = the backlog is empty
 *  but the codebase has not yet been confirmed findings-free — audit it to generate the next work.
 *  `done` = the backlog is empty AND a full audit pass found nothing (the goal — power down).
 *  `stalled` = the effective backlog is empty ONLY because every remaining open issue is cap-dropped, and no
 *  open PR can be settled either — the loop can make no further progress, so stop for a human rather than
 *  burn rounds auditing/no-op'ing. `exhausted` = the safety round cap was hit. */
export type AutoOutcome = "audit" | "develop" | "done" | "exhausted" | "stalled";

/** The pure auto-loop decision: the round cap is an UNCONDITIONAL ceiling (checked first) so a permanently
 *  un-mergeable issue — whose drafted PR keeps the backlog non-empty forever — can never spin the loop past
 *  the cap. Below the cap: develop while there is EFFECTIVE work (a within-cap backlog OR an open PR still to
 *  settle). With no effective work but cap-dropped issues remaining (and no PR left to settle), every
 *  remaining round is a provable no-op — declare `stalled` so a human unsticks the capped issues. Otherwise
 *  (a genuinely empty backlog): if this session's audit came back clean, or HEAD has NOT changed since the
 *  last clean-audit stamp, power down (`done`) — the tree is already verified. Only when HEAD HAS changed
 *  does the loop audit for new findings. The spiral's stop condition: develop -> audit -> develop -> ... ->
 *  done (findings-free), -> stalled (cap-stuck), or -> exhausted once the round cap is reached. */
export function autoDecision(state: Readonly<AutoState>): AutoOutcome {
  if (state.round >= state.maxRounds) {
    return "exhausted";
  }
  if (state.backlog > 0 || state.openPrs > 0) {
    return "develop";
  }
  if (state.capDropped > 0) {
    return "stalled";
  }
  if (state.auditedClean || !state.headChanged) {
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

/** The complement of `backlogWithinCap` — the still-open issues the cap EXCLUDED (attempted `cap`+ times
 *  without resolving). The stalled report names these so a human knows exactly which issues are stuck,
 *  honouring `backlogWithinCap`'s "surfaced for a human" promise. Pure. */
export function backlogOverCap(
  backlog: readonly number[],
  attempts: readonly AttemptCount[],
  cap: number,
): number[] {
  const counts = new Map(attempts);
  return backlog.filter((issue) => (counts.get(issue) ?? 0) >= cap);
}
