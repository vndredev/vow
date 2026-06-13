/* oxlint-disable consistent-type-specifier-style -- one import; a separate type import trips no-duplicate-imports */
import {
  type CheckStatus,
  type GitHubIssue,
  githubIssues,
  mergedPrs,
  phaselessIssues,
  readRoadmapView,
  resolveProjectId,
  roadmapViewChecks,
  staleIssues,
} from "@vow/observability";
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

/**
 * `vow reconcile` — report plan drift: open issues a merged PR already closes (retire candidates, e.g. the
 * second of a `Closes #a, #b` list GitHub's auto-close missed), and open issues carrying no phase (the
 * "No milestone" drift the roadmap can't place). Read-only — it reports, it never mutates.
 */
export function reconcile(): number {
  const cwd = process.cwd();
  const all = githubIssues(cwd);
  const open = all.filter((issue) => issue.state === "open");
  reportStale(staleIssues(open, mergedPrs(cwd)));
  reportPhaseless(phaselessIssues(all));
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
