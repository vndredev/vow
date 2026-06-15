/**
 * The local plan's types — the rich structure GitHub issues can't model. A plan item carries its
 * lifecycle, pillar, priority and ordering; `plan_dep` is the dependency DAG the ready-queue walks; a
 * `plan_session` is an agent's live claim (the local truth that replaces the stale-prone in-progress
 * label); `plan_event` is the audit trail. `issue` binds an item to a thin GitHub issue (absent = local).
 */

/** A plan item's lifecycle state — vow owns this locally, so a stale claim can't pin it (the #623 class). */
export type PlanStatus = "backlog" | "blocked" | "doing" | "done" | "parked" | "ready" | "review";

/** Where a plan item came from — vow's own internal work, an external/mirrored issue, or a user report. */
export type PlanOrigin = "external" | "internal" | "user";

/** One item on the local plan. `issue` is the GitHub binding (absent = local-only); higher `priority`
 *  sorts first; `position` is the manual order within a priority. */
export interface PlanItem {
  readonly closedAt?: string;
  readonly createdAt: string;
  readonly id: string;
  readonly issue?: number;
  readonly origin: PlanOrigin;
  readonly pillar?: string;
  readonly position: number;
  readonly priority: number;
  readonly status: PlanStatus;
  readonly title: string;
  readonly updatedAt: string;
}

/** A dependency edge — `item` is blocked by `dependsOn` (the DAG the ready-queue topologically walks). */
export interface PlanDep {
  readonly dependsOn: string;
  readonly item: string;
}

/** An agent's live claim on an item — the local truth that replaces the stale-prone in-progress label.
 *  vow reconciles it against the real worktree/PR, so an orphaned claim is released, never stuck. */
export interface PlanSession {
  readonly branch: string;
  readonly item: string;
  readonly pr?: number;
  readonly startedAt: string;
  readonly worktree: string;
}

/** One entry in an item's audit trail — richer than GitHub's issue timeline, vow-owned. */
export interface PlanEvent {
  readonly id: string;
  readonly item: string;
  readonly kind: string;
  readonly note?: string;
  readonly ts: string;
}
