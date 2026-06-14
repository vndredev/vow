/**
 * The verify + PR stage — after the agent develops a task, re-run its gates (the improve "review like a
 * tech lead": every done-criterion re-checked, not trusted) and open a PR. A run whose gates aren't all
 * green opens a DRAFT — surfaced for a human, never merged silently. The exec + git are injected, so the
 * stage is tested without running the gates or touching the network.
 */

import { COMMIT_TYPES, HEADER_MAX } from "@vow/observability";
import type { GateResult, RunResult, VerifyResult } from "./types.ts";
import { correctionBlock } from "./gate-correction.ts";

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

/** A `## How to comply` section (named rewrite per violated rule) followed by a blank separator, or "" when
 *  the verdict trips no KNOWN rule — so the fix prompt prepends the self-explaining block only when it adds
 *  signal, and the verbatim failures still stand alone otherwise. */
function complySection(verdict: VerifyResult): string {
  const block = correctionBlock(verdict);
  if (block === "") {
    return "";
  }
  return `${block}\n\n`;
}

/** The fix-round prompt — the executor re-enters its worktree to make the still-failing gates pass. It gets
 *  the SELF-EXPLAINING correction first (each violated rule NAMED with its concrete rewrite, via
 *  `correctionBlock`), then the failures verbatim, plus an instruction to fix IN PLACE, not re-approach — so
 *  a banned-syntax slip (no-ternary / no-negated-condition / no-undefined) self-corrects instead of drafting. */
export function fixPrompt(verdict: VerifyResult): string {
  const failures = verdict.results
    .filter((result) => !result.ok)
    .map((result) => `### ${result.command}\n\n${(result.output ?? "").trim()}`)
    .join("\n\n");
  return [
    "Your last changes do not pass the gates yet. Fix EVERY error below by editing the files in this",
    "worktree — keep the approach, just make it pass. When you are done, `vp check` (format + lint +",
    "typecheck) and `pnpm -r test` must BOTH exit 0; run them to confirm before you finish.",
    "",
    `${complySection(verdict)}## Failing gates`,
    "",
    failures,
  ].join("\n");
}

/** One `## Proof` checkbox per gate — `[x]` when it passed, `[ ]` when it failed, so a draft shows which
 *  gate is red right in the proof list. */
function proofLine(result: GateResult): string {
  if (result.ok) {
    return `- [x] \`${result.command}\``;
  }
  return `- [ ] \`${result.command}\``;
}

/**
 * The PR body — the template the pr-body gate demands (Summary · What · Proof · Next), so an agent's PR
 * passes that gate and reads as a real record, plus the `Closes #n` link. The Proof checkboxes carry the
 * gate verdict (a failed gate stays unchecked, marking the draft). The plan is NOT dumped: it carries its
 * own `##` headings that would pollute the section structure, and it's derivable via `vow agent plan <n>`.
 */
export function prBody(
  issue: Readonly<{ number: number; title: string }>,
  verdict: VerifyResult,
): string {
  const proof = [
    ...verdict.results.map((result) => proofLine(result)),
    "- [ ] the doc page updated with the change (verify on review)",
  ];
  return [
    "## Summary",
    `${issue.title} — developed autonomously through the vow agent loop.`,
    "",
    "## What",
    `- The change fulfilling issue #${issue.number}, developed against its verification-gated plan (see the diff).`,
    "",
    "## Proof",
    ...proof,
    "",
    "## Next",
    "—",
    "",
    `Closes #${issue.number}`,
  ].join("\n");
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

/** The header-max-length the title-lint enforces (the squash subject IS the PR title) — read from the
 *  single source in @vow/observability, the same budget `commitlint.config.js` `header-max-length` uses. */
export const PR_TITLE_MAX = HEADER_MAX;

/** The conventional-commit types — a leading one (e.g. `docs: `) means the title is already a subject, so
 *  prefixing `feat: ` again would double it. Built from the single-sourced `COMMIT_TYPES` vocabulary (the
 *  same map `commitlint.config.js` derives its `type-enum` from), so the agent and the lint can't drift. */
export const TYPE_PREFIX = new RegExp(`^(?:${Object.keys(COMMIT_TYPES).join("|")}): `, "u");

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
