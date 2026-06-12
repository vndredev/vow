/**
 * The verify + PR stage — after the agent develops a task, re-run its gates (the improve "review like a
 * tech lead": every done-criterion re-checked, not trusted) and open a PR. A run whose gates aren't all
 * green opens a DRAFT — surfaced for a human, never merged silently. The exec + git are injected, so the
 * stage is tested without running the gates or touching the network.
 */

import type { GateResult, RunResult, VerifyResult } from "./types.ts";

/** Re-run each verification gate in `cwd`; the verdict is the conjunction. The exec is injected, so this
 *  is tested without running the gates. A failed gate keeps its captured output, so the reason reaches the
 *  PR body — a self-healing loop can't act on a bare ✗. */
export async function verify(
  gates: readonly string[],
  cwd: string,
  run: (command: string, cwd: string) => Promise<RunResult>,
): Promise<VerifyResult> {
  const results = await Promise.all(
    gates.map(async (command): Promise<GateResult> => {
      const result = await run(command, cwd);
      const ok = result.code === 0;
      if (ok) {
        return { command, ok };
      }
      return { command, ok, output: result.output };
    }),
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

/** A gate's line in the PR body — the mark + command, and (for a failed gate with captured output) the
 *  reason in a fenced block, so a reviewer sees WHY it failed without re-running it locally. */
function gateLine(result: GateResult): string {
  const head = `- ${mark(result.ok)} \`${result.command}\``;
  const output = result.output?.trim() ?? "";
  if (output.length > 0) {
    return [head, "", "  ```", output, "  ```"].join("\n");
  }
  return head;
}

/** The PR body: the gate verdict, then the plan the run was developed against. */
export function prBody(plan: string, verdict: VerifyResult): string {
  const gates = verdict.results.map((result) => gateLine(result)).join("\n");
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

/** The conventional-commit types — a leading one (e.g. `docs: `) means the title is already a subject, so
 *  prefixing `feat: ` again would double it. Mirrors commit-types.json (the branch-name gate's source). */
const TYPE_PREFIX = /^(?:build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test): /u;

/** A conventional-commit subject from an issue title — kept as-is when it already opens with a type, else
 *  prefixed `feat: ` (an issue is a feature ask) with a lower-cased first letter. */
function subjectFor(title: string): string {
  if (TYPE_PREFIX.test(title)) {
    return title;
  }
  return `feat: ${title.charAt(0).toLowerCase()}${title.slice(1)}`;
}

/** The PR title (= the run's commit subject) — a conventional subject, capped at the header-max-length so
 *  the title-lint passes. */
export function prTitle(issue: Readonly<{ title: string }>): string {
  const subject = subjectFor(issue.title);
  if (subject.length <= PR_TITLE_MAX) {
    return subject;
  }
  return subject.slice(0, PR_TITLE_MAX);
}
