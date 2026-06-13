/* oxlint-disable consistent-type-specifier-style -- one import; a separate type import trips no-duplicate-imports */
import {
  type GitHubIssue,
  githubIssues,
  mergedPrs,
  phaselessIssues,
  staleIssues,
} from "@vow/observability";
/* oxlint-enable consistent-type-specifier-style */

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
