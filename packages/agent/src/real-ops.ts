import type { AgentOps, Command, RunResult } from "./types.ts";
import { worktreeAddArgs, worktreeRemoveArgs } from "./dispatch.ts";
import { execFileSync } from "node:child_process";

/** The exit status carried by a failed `execFileSync`, or 1 when there's no numeric status. */
function exitStatus(error: unknown): number {
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
  ) {
    return error.status;
  }
  return 1;
}

/** The captured stdout of a failed `execFileSync`, or "" when there's none. */
function failStdout(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "stdout" in error &&
    typeof error.stdout === "string"
  ) {
    return error.stdout;
  }
  return "";
}

/** The captured stderr of a failed `execFileSync` — where git/gh/tsgo write their actionable diagnostics. */
function failStderr(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "stderr" in error &&
    typeof error.stderr === "string"
  ) {
    return error.stderr;
  }
  return "";
}

/** The text a failed run produced — its captured stdout + stderr (the reason often sits in stderr), the
 *  error message, or a fallback. stderr matters: an empty-but-string stdout would otherwise short-circuit
 *  before the message, so the most common failures surfaced an uninformative string. */
function failOutput(error: unknown): string {
  const combined = [failStdout(error), failStderr(error)].filter(Boolean).join("\n");
  if (combined) {
    return combined;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "unknown error";
}

/** The child env: `parent` with the command's `unsetEnv` vars removed — so stripping an API key makes the
 *  provider authenticate via its subscription. Pure (parent injected), so the auth-strip is unit-tested
 *  without touching the real environment. */
export function childEnv(
  parent: Readonly<NodeJS.ProcessEnv>,
  unset: readonly string[] | undefined,
): NodeJS.ProcessEnv {
  const drop = new Set(unset);
  const env: NodeJS.ProcessEnv = {};
  for (const key of Object.keys(parent)) {
    if (!drop.has(key)) {
      env[key] = parent[key];
    }
  }
  return env;
}

/** Force-remove the worktree at `path`, tolerant of an absent / not-a-worktree path. Force drops a dirty
 *  worktree; pruning the not-a-worktree case makes the remove idempotent (so a double teardown never throws
 *  and masks the original error). The shared teardown for `worktreeRemove` + the self-cleanup on a failed
 *  install. */
function removeWorktree(path: string): void {
  try {
    execFileSync("git", [...worktreeRemoveArgs(path)], { cwd: process.cwd() });
  } catch {
    execFileSync("git", ["worktree", "prune"], { cwd: process.cwd() });
  }
}

/** Run a `command` in `cwd` synchronously, capturing exit + stdout (its `unsetEnv` stripped from the
 *  child). The codebase shells via `execFileSync`; each agent run is its own process, so blocking is fine. */
function execText(command: Command, cwd: string): RunResult {
  try {
    const stdout = execFileSync(command.bin, [...command.args], {
      cwd,
      encoding: "utf8",
      // oxlint-disable-next-line no-process-env -- the parent env to hand (filtered) to the child spawn
      env: childEnv(process.env, command.unsetEnv),
    });
    return { code: 0, output: stdout };
  } catch (error) {
    return { code: exitStatus(error), output: failOutput(error) };
  }
}

/**
 * The real `AgentOps` — git worktrees + a spawned provider CLI via `execFileSync`. The thin side-effecting
 * adapter the pure loop runs against; `run` is integration-tested with a harmless command, and the git
 * wrappers reuse the already-tested worktree args. A failed worktree command throws (loud); a failed run
 * is captured as its exit code, so the loop can open a draft PR instead of crashing.
 */
export function realOps(): AgentOps {
  return {
    run: async (command, cwd) => {
      await Promise.resolve();
      return execText(command, cwd);
    },
    worktreeAdd: async (path, branch) => {
      await Promise.resolve();
      // `git worktree add` establishes OWNERSHIP of `path`: it throws when the path already exists (a
      // Duplicate run-all lane, a collision) without touching that sibling's checkout. So a throw here means
      // THIS op created nothing; the caller must NOT tear `path` down (it would destroy the owner's
      // Worktree). Only past this line did this op materialize the worktree.
      execFileSync("git", [...worktreeAddArgs(path, branch)], { cwd: process.cwd() });
      try {
        // A fresh worktree has no node_modules (gitignored) — install so the re-run gates have their deps.
        execFileSync("vp", ["install"], { cwd: path });
      } catch (error) {
        // Git-add succeeded but install failed: this op OWNS the half-built worktree, so it cleans up after
        // Itself (never stranding the path for the next attempt) and re-throws. The caller then sees a failed
        // Add — and, because the path is already gone, must not remove it again.
        removeWorktree(path);
        throw error;
      }
    },
    worktreeRemove: async (path) => {
      await Promise.resolve();
      removeWorktree(path);
    },
  };
}
