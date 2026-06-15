/* oxlint-disable prefer-readonly-parameter-types -- the @vow/plan db handle is a mutable external object */
/* oxlint-disable consistent-type-specifier-style -- mixed type+value imports; a separate type import trips no-duplicate-imports */
import { type GitHubIssue, PILLAR_PREFIX, githubIssues } from "@vow/observability";
import {
  type IssueRef,
  type SyncActions,
  applySync,
  closeSession,
  getItem,
  listDeps,
  listItems,
  listSessions,
  openPlan,
  openSession,
  promotable,
  readyQueue,
  setStatus,
  staleSessions,
} from "@vow/plan";
import { defined } from "@vow/core";
import path from "node:path";
/* oxlint-enable consistent-type-specifier-style */

/**
 * The plan operations the autonomous loop drives — the bridge between GitHub issues (the external skin) and
 * the local plan DAG. Each round the loop SYNCS the issues in (open -> backlog, closed -> done), RECONCILES
 * stale claims against the in-flight PRs (an orphaned `doing` item released back to `ready`), AUTO-READIES
 * the unblocked backlog (backlog -> ready), then pulls the READY-QUEUE's bound issue numbers as its backlog —
 * the RIGHT next work, dependency-aware + prioritized, not the oldest open issue. It CLAIMS each developed
 * item (a local `plan_session` + `doing`), so vow owns the in-flight state, never a GitHub label that orphans
 * (the #623 class). `vow plan sync` reuses `syncPlanCwd`.
 */

/** The plan db handle — `openPlan`'s return, aliased so this module needs no `@vow/db` dependency. */
type PlanDb = ReturnType<typeof openPlan>;

/** The gitignored worktree root the develop loop checks each issue branch out under. */
const WORKTREES_DIR = ".vow-worktrees";

/** The `{ pillar }` fragment from an issue's labels, or empty (the spread keeps the absent case free of an
 *  `undefined` literal). */
function pillarFrag(issue: Readonly<GitHubIssue>): { pillar?: string } {
  for (const label of issue.labels) {
    if (label.startsWith(PILLAR_PREFIX)) {
      return { pillar: label };
    }
  }
  return {};
}

/** Map a GitHub issue to the minimal `IssueRef` the sync reads — its pillar resolved from the labels. */
export function toRef(issue: Readonly<GitHubIssue>): IssueRef {
  return { number: issue.number, state: issue.state, title: issue.title, ...pillarFrag(issue) };
}

/** Sync the live GitHub issues into the plan db (open with no item -> backlog, closed -> done). */
function syncPlanDb(db: PlanDb, cwd: string): SyncActions {
  return applySync(
    db,
    listItems(db),
    githubIssues(cwd).map((issue) => toRef(issue)),
  );
}

/** `vow plan sync` + the loop's per-round sync — open the plan db and pull the issues in, returning the
 *  actions taken so the caller can report them. */
export function syncPlanCwd(cwd: string): SyncActions {
  return syncPlanDb(openPlan(cwd), cwd);
}

/** Auto-ready the unblocked backlog (backlog -> ready) so the ready-queue reflects every developable item
 *  whose dependencies are all done. Returns the count promoted. */
function autoReady(db: PlanDb): number {
  const ids = promotable(listItems(db), listDeps(db));
  for (const id of ids) {
    setStatus(db, id, "ready");
  }
  return ids.length;
}

/** The item ids active right now — those whose bound issue has an in-flight PR (an open develop arc). */
function activeItems(db: PlanDb, inFlightIssues: readonly number[]): string[] {
  const ids: string[] = [];
  for (const item of listItems(db)) {
    if (defined(item.issue) && inFlightIssues.includes(item.issue)) {
      ids.push(item.id);
    }
  }
  return ids;
}

/** Reconcile stale claims — release any session whose item is not active (its issue not in flight). The
 *  session is closed; an orphaned `doing` item reverts to `ready` (the lifecycle release, so it is
 *  re-attempted), while a `done` item (its issue closed by the sync) just loses its session. Returns the
 *  count released. The structural fix for the stale-claim bug (#623): vow owns the claim, reconciled against
 *  the live PRs every round, never a label that orphans. */
function reconcileSessions(db: PlanDb, inFlightIssues: readonly number[]): number {
  const stale = staleSessions(listSessions(db), activeItems(db, inFlightIssues));
  for (const session of stale) {
    closeSession(db, session.item);
    const item = getItem(db, session.item);
    if (defined(item) && item.status === "doing") {
      setStatus(db, session.item, "ready");
    }
  }
  return stale.length;
}

/** The ready-queue's bound issue numbers, in priority order — the loop's backlog source. A ready item with
 *  no bound issue is local-only, not developable by the gh loop, so it is skipped. */
function readyIssues(db: PlanDb): number[] {
  const bound: number[] = [];
  for (const item of readyQueue(listItems(db), listDeps(db))) {
    if (defined(item.issue)) {
      bound.push(item.issue);
    }
  }
  return bound;
}

/**
 * One round's plan setup — sync the issues in, reconcile stale claims against the in-flight PRs, auto-ready
 * the unblocked backlog, and return the ready-queue's bound issue numbers (the loop's backlog this round).
 * The loop develops the RIGHT next work — dependency-aware + prioritized — not the oldest open issue.
 */
export function planBacklog(cwd: string, inFlightIssues: readonly number[]): number[] {
  const db = openPlan(cwd);
  syncPlanDb(db, cwd);
  reconcileSessions(db, inFlightIssues);
  autoReady(db);
  return readyIssues(db);
}

/** Claim the items the round is about to develop — open a local `plan_session` (the in-flight claim) and
 *  transition each `ready` item to `doing`, so vow owns the in-flight state. Skips an issue with no `ready`
 *  plan item (a raw issue not in the plan, or one already claimed). Sequential on one db handle (the writes
 *  are quick); the develops then run concurrently. */
export function claimIssues(cwd: string, issues: readonly number[]): void {
  const db = openPlan(cwd);
  const items = listItems(db);
  for (const issue of issues) {
    const item = items.find((each) => each.issue === issue);
    if (defined(item) && item.status === "ready") {
      const branch = `feat/issue-${issue}`;
      openSession(db, {
        branch,
        item: item.id,
        startedAt: new Date().toISOString(),
        worktree: path.join(cwd, WORKTREES_DIR, `feat-issue-${issue}`),
      });
      setStatus(db, item.id, "doing");
    }
  }
}
