import type { AgentTask, Command, Provider } from "./provider.ts";

/** The result of an autonomous run. */
export interface DispatchResult {
  readonly ok: boolean;
  readonly output: string;
}

/** A command's exit code + captured output. */
export interface RunResult {
  readonly code: number;
  readonly output: string;
}

/**
 * The side effects dispatch needs, injected so the orchestration is testable: set up an isolated git
 * worktree on a branch, run a command in it, tear it down. The real impl shells git + the CLI; a test
 * passes fakes, so `claude` never runs and no git is touched.
 */
export interface AgentOps {
  readonly run: (command: Command, cwd: string) => Promise<RunResult>;
  readonly worktreeAdd: (path: string, branch: string) => Promise<void>;
  readonly worktreeRemove: (path: string) => Promise<void>;
}

/**
 * Develop `task` with `provider` in an isolated worktree: create it on the task's branch, run the
 * provider's command there, and ALWAYS tear the worktree down. Pure orchestration over `ops` — the
 * isolation means a parallel fleet of agents can't collide on the working tree.
 */
export async function dispatch(
  task: AgentTask,
  provider: Provider,
  ops: AgentOps,
): Promise<DispatchResult> {
  await ops.worktreeAdd(task.cwd, task.branch);
  try {
    const result = await ops.run(provider.command(task), task.cwd);
    return { ok: result.code === 0, output: result.output };
  } finally {
    await ops.worktreeRemove(task.cwd);
  }
}

/** The `git worktree add` args that put `branch` at `path` (a fresh branch off HEAD). */
export function worktreeAddArgs(path: string, branch: string): readonly string[] {
  return ["worktree", "add", "-b", branch, path];
}

/** The `git worktree remove` args that tear `path` down (force — the run may have left changes). */
export function worktreeRemoveArgs(path: string): readonly string[] {
  return ["worktree", "remove", "--force", path];
}
