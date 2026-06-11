/**
 * The plan-builder — turns an issue into the self-contained, verification-gated plan an autonomous
 * executor develops (the shadcn/improve discipline). Written for the weakest plausible executor: every
 * gate is a command with a checkable result, the boundaries are explicit, and a commit stamp lets the
 * executor detect a stale plan before touching anything — so a cheaper model runs it without drifting.
 */

import type { IssueSpec, PlanContext } from "./types.ts";

/** The gates every vow plan carries, whatever the issue. */
const ALWAYS_VERIFY: readonly string[] = [
  "`vp check` exits 0 (lint + format + typecheck)",
  "`pnpm -r test` — 0 failures",
];

/** The branch an autonomous run uses for an issue — a `feat/` branch, so the branch-name gate (which
 *  requires a commit-type prefix) accepts the PR the run opens. */
export function branchFor(issue: IssueSpec): string {
  return `feat/issue-${issue.number}`;
}

/**
 * The plan string for `issue`: inlined task, machine-checkable verification gates, an explicit out-of-scope
 * list, STOP conditions, and the commit stamp. The product the executor follows — no outside context, no
 * judgement calls.
 */
export function buildPlan(issue: IssueSpec, context: PlanContext): string {
  const gates = [...ALWAYS_VERIFY, ...context.verify].map((line) => `- ${line}`).join("\n");
  return [
    `# Plan: ${issue.title} (#${issue.number})`,
    "",
    `Written against commit \`${context.commit}\`. Verify HEAD still matches before you start; if it has moved, re-read the changed files or STOP.`,
    "",
    "## The task",
    issue.body,
    "",
    "## Verification gates",
    "Run each; every one must pass. These are machine-checkable — never judge success yourself.",
    gates,
    "",
    "## Out of scope",
    '- Anything not named in "The task". Do not refactor, rename, or touch adjacent code.',
    "",
    "## STOP conditions — stop and report, never improvise",
    "- A verification command fails in a way the task did not anticipate.",
    "- The commit stamp above no longer matches HEAD (the plan is stale).",
    "- The change would touch a file outside the task's scope.",
  ].join("\n");
}
