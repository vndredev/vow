import type { CiState } from "./types.ts";

/**
 * The agent-merge stage — close the loop. After the PR, CI runs the `gate`; the agent merges a GREEN run
 * (squash + delete the branch) and leaves a RED run as a draft (surfaced for a human, never merged off
 * red). Pure: the runner polls CI for the state and acts on the verdict — what makes the loop autonomous
 * without ever merging a failing change.
 */

/** The agent's merge decision from the CI conclusion: green -> merge, red -> draft, pending -> wait. */
export function mergeDecision(ci: CiState): "draft" | "merge" | "wait" {
  if (ci === "pass") {
    return "merge";
  }
  if (ci === "fail") {
    return "draft";
  }
  return "wait";
}

/** The `gh pr merge` args — squash + delete the branch, how the agent merges a green PR. */
export function mergeArgs(pr: number): readonly string[] {
  return ["pr", "merge", String(pr), "--squash", "--delete-branch"];
}

/** The `gh pr ready --undo` args — flip a red PR back to draft (surfaced for a human, never mergeable). */
export function draftArgs(pr: number): readonly string[] {
  return ["pr", "ready", String(pr), "--undo"];
}
