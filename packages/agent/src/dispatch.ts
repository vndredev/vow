import type { AgentOps, AgentTask, DispatchResult, Provider } from "./types.ts";

/**
 * Run `provider` on `task` in `task.cwd` (an already-prepared worktree). Pure over `ops.run` — the worktree
 * lifecycle belongs to the caller (`runTask`), because verify must run in the SAME worktree before teardown.
 */
export async function dispatch(
  task: AgentTask,
  provider: Provider,
  ops: AgentOps,
): Promise<DispatchResult> {
  const result = await ops.run(provider.command(task), task.cwd);
  return { ok: result.code === 0, output: result.output };
}

/** The `git worktree add` args that put `branch` at `path` (a fresh branch off HEAD). */
export function worktreeAddArgs(path: string, branch: string): readonly string[] {
  return ["worktree", "add", "-b", branch, path];
}

/** The `git worktree remove` args that tear `path` down (force — the run may have left changes). */
export function worktreeRemoveArgs(path: string): readonly string[] {
  return ["worktree", "remove", "--force", path];
}

/** The worktree path for `branch` under the repo's gitignored `.vow-worktrees/` — a checkout isolated from
 *  the repo root (and from other agents), provider-neutral (not tied to any one CLI's config dir). Branch
 *  slashes become dashes (a flat directory name). */
export function worktreePath(repo: string, branch: string): string {
  return `${repo}/.vow-worktrees/${branch.replaceAll("/", "-")}`;
}
