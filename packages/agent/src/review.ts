/**
 * Spec-compliance review — a distinct, fresh-reviewer pass that checks "did the provider build EXACTLY
 * what the issue asked: no over-build, no under-build?" BEFORE the quality gates. The reviewer is
 * headless and read-only (the same audit-command shape); the loop re-dispatches the provider with the
 * reviewer's feedback until compliant or the round cap is reached, then hands off to the gate stage.
 * Provider-neutral: the review command is built by the Provider seam; this module never names a bin.
 */

import type { AgentOps, AgentTask, Auth, IssueSpec, Provider, SpecReviewResult } from "./types.ts";
import { modelFor } from "./model.ts";

/** The review instruction — tells a headless reviewer to read the worktree and check spec compliance.
 *  Output is a JSON object: { compliant: boolean, feedback: string }. */
export function buildReviewPrompt(title: string, body: string): string {
  return [
    "You are a spec-compliance reviewer. Check whether the code in this worktree fulfils the issue exactly.",
    "",
    `## Issue: ${title}`,
    "",
    body,
    "",
    "Read the changed files in this worktree. Then answer:",
    "- Does the change fulfil EXACTLY what the issue asked? No over-build (extra features not in the issue),",
    "  no under-build (missing something the issue required)?",
    "",
    "Output ONLY a JSON object (no prose, no markdown fence):",
    '{"compliant": true, "feedback": ""}',
    "or",
    '{"compliant": false, "feedback": "A concrete description of what is missing or extra."}',
    "",
    "Do NOT edit any file.",
  ].join("\n");
}

/** The correction prompt when a spec review finds a deviation — tells the provider to fix ONLY the gap,
 *  not re-approach. Provider-neutral: the provider name never appears here. */
export function specFixPrompt(feedback: string): string {
  return [
    "The spec-compliance review found a deviation from the issue:",
    "",
    feedback,
    "",
    "Correct this deviation in the worktree — do not over-build or re-approach. Only fix the gap.",
  ].join("\n");
}

/** Whether `value` is a non-null object — the entry guard for safely reading a parsed JSON object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** The feedback string from a raw JSON value — an empty string when the value is not a string. */
function buildFeedback(raw: unknown): string {
  if (typeof raw === "string") {
    return raw;
  }
  return "";
}

/** Parse the reviewer's JSON output to a SpecReviewResult. Falls back to non-compliant when the output
 *  is malformed (a reviewer that cannot output valid JSON is itself a signal something is wrong). */
export function parseReviewOutput(rawOutput: string): SpecReviewResult {
  try {
    const parsed: unknown = JSON.parse(rawOutput.trim());
    if (isRecord(parsed)) {
      const rawCompliant: unknown = parsed["compliant"];
      if (typeof rawCompliant === "boolean") {
        return { compliant: rawCompliant, feedback: buildFeedback(parsed["feedback"]) };
      }
    }
  } catch {
    // Malformed JSON — fall through to the non-compliant default
  }
  return { compliant: false, feedback: "Spec review output could not be parsed." };
}

/** The inputs a single spec-review pass needs — separates the review concern from the full TaskRequest. */
export interface ReviewOpts {
  readonly auth: Auth | undefined;
  readonly ops: AgentOps;
  readonly provider: Provider;
}

/** Run one spec-compliance review of `task.cwd` via the provider's headless read-only command. Returns
 *  compliant immediately when the provider has no `reviewCommand` (no headless mode — review is skipped).
 *  A review command that exits non-zero is itself a non-compliant result. */
export async function specReviewOnce(
  issue: IssueSpec,
  task: AgentTask,
  opts: ReviewOpts,
): Promise<SpecReviewResult> {
  if (!opts.provider.reviewCommand) {
    return { compliant: true, feedback: "" };
  }
  const model = modelFor(opts.provider.models, "audit");
  const prompt = buildReviewPrompt(issue.title, issue.body);
  const command = opts.provider.reviewCommand(model, prompt, opts.auth);
  const result = await opts.ops.run(command, task.cwd);
  if (result.code !== 0) {
    return { compliant: false, feedback: "Spec review command exited non-zero." };
  }
  return parseReviewOutput(result.output);
}
