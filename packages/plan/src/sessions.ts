import type { PlanSession } from "./types.ts";

/**
 * The session-reconcile resolver — which agent claims (`plan_session`) are stale and must be released. vow
 * owns the claim locally (replacing the stale-prone GitHub in-progress label, the #623 class), so the loop
 * reconciles it against reality every tick: a session whose item is no longer ACTIVE — no in-flight PR and
 * its worktree gone — is orphaned. Pure — the caller computes the active set from gh + the filesystem, and
 * transitions the released items back to `ready`.
 */

/** The stale sessions — those whose item is NOT in the active set (an item with an in-flight PR or a live
 *  worktree). The caller closes each + reverts its item, so an orphaned claim never sticks (the #623 class). */
export function staleSessions(
  sessions: readonly PlanSession[],
  activeItems: readonly string[],
): PlanSession[] {
  return sessions.filter((session) => !activeItems.includes(session.item));
}
