import { addItem, setItemDone } from "./store.ts";
import type { Db } from "@vow/db";
import type { PlanItem } from "./types.ts";
import { defined } from "@vow/core";

/**
 * The issue binding + inbound sync — GitHub issues are the external skin, the local plan is the structure.
 * This is the ONE place GitHub feeds the plan: an open issue with no plan item yet is ingested as a
 * backlog item (bound by number); a plan item whose bound issue has closed is marked done (the external
 * truth wins, so the close bypasses the lifecycle). Pure resolution (`syncActions`) + an apply over the
 * DB. The caller maps a GitHub issue to the minimal `IssueRef` (resolving the pillar from its labels), so
 * this layer stays GitHub-agnostic.
 */

/** The minimal GitHub-issue shape the sync reads — number (the binding), title, open/closed, and a
 *  pre-resolved pillar (the caller maps it from the issue's labels). */
export interface IssueRef {
  readonly number: number;
  readonly pillar?: string;
  readonly state: "closed" | "open";
  readonly title: string;
}

/** The sync plan — open issues to ingest as backlog items + bound items to close (their issue closed). */
export interface SyncActions {
  readonly close: readonly PlanItem[];
  readonly ingest: readonly IssueRef[];
}

/** The issue numbers a plan item is already bound to — so a re-sync doesn't double-ingest. */
function boundNumbers(items: readonly PlanItem[]): ReadonlySet<number> {
  const out = new Set<number>();
  for (const item of items) {
    if (defined(item.issue)) {
      out.add(item.issue);
    }
  }
  return out;
}

/** The numbers of the closed issues — the items bound to these are done. */
function closedNumbers(issues: readonly IssueRef[]): ReadonlySet<number> {
  const out = new Set<number>();
  for (const issue of issues) {
    if (issue.state === "closed") {
      out.add(issue.number);
    }
  }
  return out;
}

/**
 * Compute the sync actions: an OPEN issue with no plan item yet → ingest; a plan item bound to a
 * now-CLOSED issue, not already done → close. Pure — the caller applies them.
 */
export function syncActions(items: readonly PlanItem[], issues: readonly IssueRef[]): SyncActions {
  const bound = boundNumbers(items);
  const closed = closedNumbers(issues);
  const ingest = issues.filter((issue) => issue.state === "open" && !bound.has(issue.number));
  const close = items.filter(
    (item) => defined(item.issue) && closed.has(item.issue) && item.status !== "done",
  );
  return { close, ingest };
}

/**
 * Apply the inbound sync against the DB — ingest each new open issue as a backlog plan item (bound by
 * number, origin `external`, its pillar carried), and mark each item whose issue closed as done. Returns
 * the actions taken, so the caller reports what changed.
 */
export function applySync(
  db: Db,
  items: readonly PlanItem[],
  issues: readonly IssueRef[],
): SyncActions {
  const actions = syncActions(items, issues);
  for (const issue of actions.ingest) {
    addItem(db, {
      issue: issue.number,
      origin: "external",
      pillar: issue.pillar,
      title: issue.title,
    });
  }
  for (const item of actions.close) {
    setItemDone(db, item.id);
  }
  return actions;
}
