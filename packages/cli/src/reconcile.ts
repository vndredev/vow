/* oxlint-disable consistent-type-specifier-style -- one import; a separate type import trips no-duplicate-imports */
import { type GitHubIssue, githubIssues, mergedPrs, staleIssues } from "@vow/observability";
import { type PlanItem, listItems, loadSnapshot, openPlan, writeSnapshot } from "@vow/plan";
import { defined } from "@vow/core";
/* oxlint-enable consistent-type-specifier-style */
import { syncPlanCwd } from "./plan-ops.ts";

/*
 * The read-only diagnostics — they report drift, never mutate. `reconcile` checks the issue PLAN (the
 * retire candidates — open issues a merged PR already closes). A surfacing tool: the human (or the agent)
 * acts on what it names.
 */

/** Report the retire candidates — open issues a merged PR already closes. */
function reportStale(stale: readonly GitHubIssue[]): void {
  if (stale.length === 0) {
    process.stdout.write("backlog reconciled — no open issue is already closed by a merged PR\n");
    return;
  }
  process.stdout.write("retire — a merged PR already closes these, but they are still open:\n");
  for (const issue of stale) {
    process.stdout.write(`  #${issue.number} ${issue.title}\n`);
  }
}

/**
 * `vow reconcile` — report plan drift: open issues a merged PR already closes (retire candidates, e.g. the
 * second of a `Closes #a, #b` list GitHub's auto-close missed). Read-only — it reports, it never mutates.
 */
export function reconcile(): number {
  const cwd = process.cwd();
  const open = githubIssues(cwd).filter((issue) => issue.state === "open");
  reportStale(staleIssues(open, mergedPrs(cwd)));
  return 0;
}

/** The short prefix of a local plan item's id, shown when it carries no GitHub issue number. */
const ID_SHORT = 8;

/** A plan item's reference — its `#issue` when bound, else a short local id. */
function itemRef(item: PlanItem): string {
  if (defined(item.issue)) {
    return `#${item.issue}`;
  }
  return item.id.slice(0, ID_SHORT);
}

/** Bootstrap from the committed snapshot before a sync — on a fresh clone the db has no items yet, so
 *  regenerate it from `.vow/plan.jsonl` (when one exists) before the live issues sync on top. A no-op once
 *  the db carries items (the steady state). */
function bootstrapFromSnapshot(cwd: string): void {
  const db = openPlan(cwd);
  if (listItems(db).length === 0) {
    loadSnapshot(cwd, db);
  }
}

/**
 * `vow plan sync` — pull the GitHub issues into the local plan: a new open issue with no item yet is
 * ingested as a `backlog` item (bound by number, its pillar carried), a closed issue's item is marked
 * `done`. On a fresh clone (an empty db) it first regenerates from the committed `.vow/plan.jsonl`, then
 * the live issues sync on top. The CLI front-door for the MCP's `sync_plan`; `syncPlanCwd` (the loop's
 * per-round sync) is the one place GitHub feeds the local plan.
 */
function planSync(): number {
  const cwd = process.cwd();
  bootstrapFromSnapshot(cwd);
  const actions = syncPlanCwd(cwd);
  process.stdout.write(
    `synced — ingested ${actions.ingest.length}, closed ${actions.close.length}\n`,
  );
  return 0;
}

/** `vow plan snapshot` — write the committed plan snapshot (`.vow/plan.jsonl`) from the local db, the
 *  git-tracked, PR-reviewed form of the plan's items + dependency edges. */
function planWriteSnapshot(): number {
  const cwd = process.cwd();
  writeSnapshot(cwd, openPlan(cwd));
  process.stdout.write("wrote .vow/plan.jsonl\n");
  return 0;
}

/** `vow plan restore` — regenerate the local db from the committed `.vow/plan.jsonl` (the fresh-clone
 *  bootstrap, run on demand). Reports when no snapshot is committed yet. */
function planRestore(): number {
  const cwd = process.cwd();
  if (loadSnapshot(cwd, openPlan(cwd))) {
    process.stdout.write("restored the local plan from .vow/plan.jsonl\n");
    return 0;
  }
  process.stdout.write("no snapshot — .vow/plan.jsonl is not committed yet\n");
  return 0;
}

/** Print the local plan (read-only) — every item by position, its reference, status, and title. */
function planPrint(): number {
  const items = listItems(openPlan(process.cwd()));
  if (items.length === 0) {
    process.stdout.write("the plan is empty — run `vow plan sync` or add an item via the MCP\n");
    return 0;
  }
  for (const item of items) {
    process.stdout.write(`${itemRef(item)}  [${item.status}]  ${item.title}\n`);
  }
  return 0;
}

/**
 * `vow plan` — read the local plan from `.vow/plan.db` (every item by position); `vow plan sync` pulls the
 * GitHub issues into it (open → `backlog`, closed → `done`, bootstrapping from the snapshot on a fresh
 * clone); `vow plan snapshot` writes the committed `.vow/plan.jsonl`; `vow plan restore` regenerates the db
 * from it. The rich plan lives locally; other writes go through the MCP tools / the studio.
 */
export function plan(rest: readonly string[]): number {
  const [sub] = rest;
  if (sub === "sync") {
    return planSync();
  }
  if (sub === "snapshot") {
    return planWriteSnapshot();
  }
  if (sub === "restore") {
    return planRestore();
  }
  return planPrint();
}
