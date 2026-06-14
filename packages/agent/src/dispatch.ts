import type { AgentOps, AgentTask, Command, DispatchResult, Provider } from "./types.ts";

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

/** The `git worktree add` args that put `branch` at `path` — `-B` (create-or-reset off HEAD) so a re-run
 *  of an issue whose prior branch lingers (teardown drops the worktree, not the branch) doesn't fail. */
export function worktreeAddArgs(path: string, branch: string): readonly string[] {
  return ["worktree", "add", "-B", branch, path];
}

/** The `git worktree remove` args that tear `path` down (force — the run may have left changes). */
export function worktreeRemoveArgs(path: string): readonly string[] {
  return ["worktree", "remove", "--force", path];
}

/** The gitignored directory the per-issue worktrees live under, relative to the repo root. */
export const WORKTREES_DIR = ".vow-worktrees";

/** The worktree path for `branch` under the repo's gitignored `.vow-worktrees/` — a checkout isolated from
 *  the repo root (and from other agents), provider-neutral (not tied to any one CLI's config dir). Branch
 *  slashes become dashes (a flat directory name). */
export function worktreePath(repo: string, branch: string): string {
  return `${repo}/${WORKTREES_DIR}/${branch.replaceAll("/", "-")}`;
}

/** A per-issue worktree dir name (`feat-issue-231`) -> the issue number it develops, or 0 when the name is
 *  not a vow per-issue worktree (so an unrelated dir under `.vow-worktrees/` is never touched). Mirrors the
 *  `feat/issue-N` branch -> dir mapping (`worktreePath` dashes the slash). */
const WORKTREE_ISSUE = /^feat-issue-(\d+)$/u;

/** The issue number a per-issue worktree dir `name` develops, or 0 when `name` is not a `feat-issue-N` dir. */
export function worktreeIssue(name: string): number {
  const match = WORKTREE_ISSUE.exec(name);
  if (!match) {
    return 0;
  }
  return Number(match[1]);
}

/** The STALE per-issue worktrees among `dirs` (the names under `.vow-worktrees/`) — the ones a new round may
 *  safely remove on startup (#681). A worktree is stale when its issue is NOT in `active` (the issues the
 *  current run is developing this round). A leftover `feat-issue-N` from a prior run whose issue has since
 *  closed/merged blocks the new round's `git worktree add -B feat/issue-N` ("branch already used by
 *  worktree"); pruning the stale ones lets the branch be reused. A non-`feat-issue-N` dir is left untouched
 *  (`worktreeIssue` returns 0, excluded by the issue-0 skip), and an active issue's worktree is SPARED so an
 *  in-flight run is never torn out from under itself. Pure — the CLI lists the dirs + supplies the active
 *  issue numbers, then removes the returned names. */
export function staleWorktrees(dirs: readonly string[], active: readonly number[]): string[] {
  const keep = new Set(active);
  const stale: string[] = [];
  for (const name of dirs) {
    const issue = worktreeIssue(name);
    if (issue !== 0 && !keep.has(issue)) {
      stale.push(name);
    }
  }
  return stale;
}

/** Split a gate string into a binary + args, so a gate runs as a direct exec (argv) — never `sh -c
 *  <string>`, which would make the gate text a shell-eval sink. Gates are plain `bin arg arg` (no shell
 *  features), so whitespace tokenizing is enough. */
export function gateCommand(gate: string): Command {
  const [bin = "", ...args] = gate.trim().split(/\s+/u);
  return { args, bin };
}
