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

/** The `gh pr merge` args — squash + delete the branch, how the agent merges a green PR. A non-empty
 *  `matchHead` appends `--match-head-commit <sha>`: gh refuses the merge server-side unless the PR's head is
 *  still that exact SHA, closing the TOCTOU window between the pinned-green CI read and the merge call (any
 *  push to the branch in that gap makes gh exit non-zero with the PR still OPEN). Empty `matchHead` = no pin,
 *  the unpinned `vow agent merge` front door's documented semantics. */
export function mergeArgs(pr: number, matchHead = ""): readonly string[] {
  const args = ["pr", "merge", String(pr), "--squash", "--delete-branch"];
  if (matchHead === "") {
    return args;
  }
  return [...args, "--match-head-commit", matchHead];
}

/** The `gh pr ready --undo` args — flip a red PR back to draft (surfaced for a human, never mergeable). */
export function draftArgs(pr: number): readonly string[] {
  return ["pr", "ready", String(pr), "--undo"];
}
