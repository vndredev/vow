/* oxlint-disable consistent-type-specifier-style -- one import; a separate type import trips no-duplicate-imports */
import {
  type CheckStatus,
  type GitHubIssue,
  PILLAR_PREFIX,
  githubIssues,
  mergedPrs,
  phaselessIssues,
  pillarlessIssues,
  readRoadmapView,
  resolveProjectId,
  roadmapViewChecks,
  staleIssues,
} from "@vow/observability";
import { type IssueRef, type PlanItem, applySync, listItems, openPlan } from "@vow/plan";
import { defined } from "@vow/core";
/* oxlint-enable consistent-type-specifier-style */

/*
 * The read-only diagnostics — they report drift, never mutate. `reconcile` checks the issue PLAN (retire
 * candidates + phase-less issues); `doctor` checks the GitHub Project's Roadmap VIEW against vow's
 * invariant. Both are surfacing tools: the human (or the agent) acts on what they name.
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

/** Report the phase-less drift — open issues with no milestone, which fall off the roadmap's plan (the
 *  "No milestone" bucket). The creation-time default keeps this empty; this is the safety net. */
function reportPhaseless(phaseless: readonly GitHubIssue[]): void {
  if (phaseless.length === 0) {
    process.stdout.write("plan phased — every open issue carries a phase (a milestone)\n");
    return;
  }
  process.stdout.write(
    "phase-less — these open issues have no phase, so they drift off the roadmap:\n",
  );
  for (const issue of phaseless) {
    process.stdout.write(`  #${issue.number} ${issue.title}\n`);
  }
}

/** Report the pillar-less drift — open issues with no `pillar:` label, off the throughline (the capability
 *  axis). The createIssue router defaults one for new work; this surfaces any that routed nowhere or
 *  predate the router. */
function reportPillarless(pillarless: readonly GitHubIssue[]): void {
  if (pillarless.length === 0) {
    process.stdout.write("plan aligned — every open issue carries a pillar (a throughline)\n");
    return;
  }
  process.stdout.write(
    "pillar-less — these open issues have no pillar, so they drift off the throughline:\n",
  );
  for (const issue of pillarless) {
    process.stdout.write(`  #${issue.number} ${issue.title}\n`);
  }
}

/**
 * `vow reconcile` — report plan drift: open issues a merged PR already closes (retire candidates, e.g. the
 * second of a `Closes #a, #b` list GitHub's auto-close missed), open issues carrying no phase (the "No
 * milestone" drift the roadmap can't place), and open issues carrying no pillar (off the throughline).
 * Read-only — it reports, it never mutates.
 */
export function reconcile(): number {
  const cwd = process.cwd();
  const all = githubIssues(cwd);
  const open = all.filter((issue) => issue.state === "open");
  reportStale(staleIssues(open, mergedPrs(cwd)));
  reportPhaseless(phaselessIssues(all));
  reportPillarless(pillarlessIssues(all));
  return 0;
}

/** The glyph for a doctor check status — `✓` holds, `✗` is fixable drift, `□` is a UI-only checklist item. */
function glyph(status: CheckStatus): string {
  if (status === "ok") {
    return "✓";
  }
  if (status === "drift") {
    return "✗";
  }
  return "□";
}

/**
 * `vow doctor` — check vow's plan-on-GitHub against the declared invariant: the Project's Roadmap view. A
 * spike (#539) found the Projects v2 API can SET no view config (it is UI-only) and reads back only the
 * layout + group-by. So doctor verifies what's readable (the view exists, grouped by Milestone → a real
 * ✓/✗) and lists the rest (`□` Date field → Milestone, `□` Markers → Milestones) as the manual steps to
 * apply in the Roadmap toolbar. Read-only; vow's own studio roadmap needs none of it (gh-direct).
 */
export function doctor(): number {
  const cwd = process.cwd();
  // oxlint-disable-next-line no-process-env -- the configured Project node id; absent = fall back to config
  const projectId = resolveProjectId(cwd, process.env["VOW_PROJECT_ID"]);
  if (typeof projectId !== "string") {
    process.stdout.write("vow doctor: no Project configured — nothing to check\n");
    return 0;
  }
  process.stdout.write("vow doctor — the GitHub Project Roadmap view (its config is UI-only):\n");
  for (const check of roadmapViewChecks(readRoadmapView(cwd, projectId))) {
    process.stdout.write(`  ${glyph(check.status)} ${check.text}\n`);
  }
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

/** The `{ pillar }` fragment from an issue's labels, or empty — carried onto the synced item (the spread
 *  keeps the absent case free of an `undefined` literal). */
function pillarFrag(issue: Readonly<GitHubIssue>): { pillar?: string } {
  for (const label of issue.labels) {
    if (label.startsWith(PILLAR_PREFIX)) {
      return { pillar: label };
    }
  }
  return {};
}

/** Map a GitHub issue to the minimal `IssueRef` the sync reads — its pillar resolved from the labels. */
function toRef(issue: Readonly<GitHubIssue>): IssueRef {
  return { number: issue.number, state: issue.state, title: issue.title, ...pillarFrag(issue) };
}

/**
 * `vow plan sync` — pull the GitHub issues into the local plan: a new open issue with no item yet is
 * ingested as a `backlog` item (bound by number, its pillar carried), a closed issue's item is marked
 * `done`. The CLI front-door for the MCP's `sync_plan` — the one place GitHub feeds the local plan.
 */
function planSync(): number {
  const cwd = process.cwd();
  const db = openPlan(cwd);
  const actions = applySync(
    db,
    listItems(db),
    githubIssues(cwd).map((issue) => toRef(issue)),
  );
  process.stdout.write(
    `synced — ingested ${actions.ingest.length}, closed ${actions.close.length}\n`,
  );
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
 * GitHub issues into it (open → `backlog`, closed → `done`). The rich plan lives locally; other writes go
 * through the MCP tools / the studio.
 */
export function plan(rest: readonly string[]): number {
  const [sub] = rest;
  if (sub === "sync") {
    return planSync();
  }
  return planPrint();
}
