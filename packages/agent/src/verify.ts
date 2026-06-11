/**
 * The verify + PR stage — after the agent develops a task, re-run its gates (the improve "review like a
 * tech lead": every done-criterion re-checked, not trusted) and open a PR. A run whose gates aren't all
 * green opens a DRAFT — surfaced for a human, never merged silently. The exec + git are injected, so the
 * stage is tested without running the gates or touching the network.
 */

import type { GateResult, VerifyResult } from "./types.ts";

/** Re-run each verification gate in `cwd`; the verdict is the conjunction. The exec is injected, so this
 *  is tested without running the gates. */
export async function verify(
  gates: readonly string[],
  cwd: string,
  run: (command: string, cwd: string) => Promise<number>,
): Promise<VerifyResult> {
  const results = await Promise.all(
    gates.map(
      async (command): Promise<GateResult> => ({ command, ok: (await run(command, cwd)) === 0 }),
    ),
  );
  return { ok: results.every((result) => result.ok), results };
}

/** A pass/fail mark for the PR body. */
function mark(ok: boolean): string {
  if (ok) {
    return "✓";
  }
  return "✗";
}

/** The `git push` args that publish the task's branch upstream. */
export function pushArgs(branch: string): readonly string[] {
  return ["push", "-u", "origin", branch];
}

/** The `gh pr create` args — title + body; a DRAFT when the gates didn't all pass (a red run is surfaced
 *  for a human, never mergeable). */
export function prCreateArgs(title: string, body: string, verified: boolean): readonly string[] {
  const base = ["pr", "create", "--title", title, "--body", body];
  if (verified) {
    return base;
  }
  return [...base, "--draft"];
}

/** The PR body: the gate verdict, then the plan the run was developed against. */
export function prBody(plan: string, verdict: VerifyResult): string {
  const gates = verdict.results
    .map((result) => `- ${mark(result.ok)} \`${result.command}\``)
    .join("\n");
  return [`## Verification ${mark(verdict.ok)}`, gates, "", "## Plan", plan].join("\n");
}

/** The `git add -A` args — stage the agent's edits + any new files before committing. */
export function stageArgs(): readonly string[] {
  return ["add", "-A"];
}

/** The `git commit` args for the agent's worktree run. `--no-verify` skips the local pre-commit hook on
 *  purpose: the gates re-run in `verify` (and again in CI), so the hook is redundant here, and its
 *  `vp check --fix` can corrupt mid-run. The commit is squashed away by the PR-title merge. */
export function commitArgs(message: string): readonly string[] {
  return ["commit", "-m", message, "--no-verify"];
}

/** The 72-char header-max-length the title-lint enforces (the squash subject IS the PR title). */
const PR_TITLE_MAX = 72;

/** The conventional-commit subject for the run's commit + PR title — defaults to `feat:` (an issue is a
 *  feature ask), lower-cased, capped at the header-max-length so the title-lint passes. */
export function prTitle(issue: Readonly<{ title: string }>): string {
  const subject = `feat: ${issue.title.charAt(0).toLowerCase()}${issue.title.slice(1)}`;
  if (subject.length <= PR_TITLE_MAX) {
    return subject;
  }
  return subject.slice(0, PR_TITLE_MAX);
}
