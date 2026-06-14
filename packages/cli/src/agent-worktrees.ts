import { WORKTREES_DIR, staleWorktrees } from "@vow/agent";
import { existsSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

/**
 * The self-heal loop's WORKTREE hygiene (#681) — pruning a prior run's leftover `.vow-worktrees/feat-issue-N`
 * so a new round's `git worktree add -B feat/issue-N` doesn't hit "branch already used by worktree" and can
 * reuse the branch. The staleness DECISION is the pure `staleWorktrees` in @vow/agent (which issues to keep);
 * this module is its fs + git-shelling wrapper, kept out of `agent-auto.ts` so that file stays under the
 * max-lines wall.
 */

/** The message of a thrown value — an `Error`'s `.message`, else its string form. */
function reasonOf(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/** The directory entry names directly under `cwd`'s gitignored `.vow-worktrees/`, or [] when it doesn't
 *  exist yet (a first run, or no leftover worktrees) — the candidate set the stale-cleanup filters. */
function worktreeDirs(cwd: string): string[] {
  const root = path.join(cwd, WORKTREES_DIR);
  if (!existsSync(root)) {
    return [];
  }
  const names: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      names.push(entry.name);
    }
  }
  return names;
}

/** Force-remove the leftover worktree `name` under `.vow-worktrees/`, then `git worktree prune` to clear its
 *  metadata — tolerant of a not-a-worktree dir (a manual mkdir): the remove throws, prune mops up either way.
 *  Best-effort; cleanup must never abort the loop's startup. */
function removeStaleWorktree(name: string, cwd: string): void {
  const at = path.join(cwd, WORKTREES_DIR, name);
  try {
    execFileSync("git", ["worktree", "remove", "--force", at], { cwd });
  } catch {
    // Not a registered worktree (a stray dir) — prune below clears any dangling metadata regardless.
  }
  execFileSync("git", ["worktree", "prune"], { cwd });
}

/** Remove the STALE per-issue worktrees on startup (#681) — the leftover `.vow-worktrees/feat-issue-N` from a
 *  prior run whose issue is NOT in `active` (the issues the current run is developing). Without this a new
 *  round's `git worktree add -B feat/issue-N` fails ("branch already used by worktree") on a leftover, so the
 *  branch can't be reused; the cleanup prunes them so a fresh run reuses the branch cleanly. An ACTIVE issue's
 *  worktree is SPARED (`staleWorktrees` keeps it) so an in-flight run is never torn out from under itself, and
 *  a non-`feat-issue-N` dir is left untouched. Each remove is isolated (best-effort) so one bad dir never
 *  aborts startup. Returns the count removed (for the banner/log). */
export function cleanStaleWorktrees(cwd: string, active: readonly number[]): number {
  const stale = staleWorktrees(worktreeDirs(cwd), active);
  let removed = 0;
  for (const name of stale) {
    try {
      removeStaleWorktree(name, cwd);
      removed += 1;
    } catch (error) {
      process.stdout.write(
        `auto: worktree ${name} cleanup threw — continuing (${reasonOf(error)})\n`,
      );
    }
  }
  return removed;
}
