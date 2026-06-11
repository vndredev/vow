import { githubIssues, mergedPrs, staleIssues } from "@vow/observability";

/**
 * `vow reconcile` — report backlog drift: open issues a merged PR already closes (the retire candidates,
 * e.g. the second of a `Closes #a, #b` list that GitHub's auto-close missed), so the board can be brought
 * back to 1:1 with reality. Read-only — it reports, it never mutates.
 */
export function reconcile(): number {
  const cwd = process.cwd();
  const open = githubIssues(cwd).filter((issue) => issue.state === "open");
  const stale = staleIssues(open, mergedPrs(cwd));
  if (stale.length === 0) {
    process.stdout.write("backlog reconciled — no open issue is already closed by a merged PR\n");
    return 0;
  }
  process.stdout.write("retire — a merged PR already closes these, but they are still open:\n");
  for (const issue of stale) {
    process.stdout.write(`  #${issue.number} ${issue.title}\n`);
  }
  return 0;
}
