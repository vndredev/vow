/**
 * The plan-builder — turns an issue into the self-contained, verification-gated plan an autonomous
 * executor develops (the shadcn/improve discipline). Written for the weakest plausible executor: every
 * gate is a command with a checkable result, the boundaries are explicit, and a commit stamp lets the
 * executor detect a stale plan before touching anything — so a cheaper model runs it without drifting.
 *
 * The plan's STRUCTURE is the scaffolded `plan.md` template (or its built-in default); `buildPlan` fills the
 * live facts (`{title}`, `{commit}`, `{focus}`, `{body}`, `{gates}`) into it, so a user tuning the discipline
 * edits the template — not this source.
 */

import { DEFAULT_PLAN_PROMPT, fillPrompt } from "./prompts.ts";
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

/** The `{focus}` substitution — a `## Focus` block (with a trailing blank line, so it sits cleanly above the
 *  next section) when the run carries a specialist's focus, else empty (the section disappears entirely). */
function focusBlock(focus: string): string {
  if (focus === "") {
    return "";
  }
  return `## Focus\n${focus}\n\n`;
}

/**
 * The plan string for `issue`: the scaffolded plan TEMPLATE (or `DEFAULT_PLAN_PROMPT`) filled with the live
 * facts — the inlined task, machine-checkable verification gates, the explicit out-of-scope list, the STOP
 * conditions, and the commit stamp. The product the executor follows — no outside context, no judgement
 * calls. Pass the scaffolded `plan.md` as `template` to let a user-edited prompt drive the run.
 */
export function buildPlan(
  issue: IssueSpec,
  context: PlanContext,
  template: string = DEFAULT_PLAN_PROMPT,
): string {
  const gates = [...ALWAYS_VERIFY, ...context.verify].map((line) => `- ${line}`).join("\n");
  return fillPrompt(template, {
    body: issue.body,
    commit: context.commit,
    focus: focusBlock(context.focus ?? ""),
    gates,
    number: String(issue.number),
    title: issue.title,
  });
}
