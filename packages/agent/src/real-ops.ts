import type { AgentOps, RunResult } from "./types.ts";
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

/** The text a failed run produced — its captured stdout, the error message, or a fallback. */
function failOutput(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "stdout" in error &&
    typeof error.stdout === "string"
  ) {
    return error.stdout;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "unknown error";
}

/** Run a binary in `cwd` synchronously, capturing exit + stdout. The codebase shells via `execFileSync`;
 *  each agent run is its own process, so blocking here is fine — parallelism is across processes. */
function execText(bin: string, args: readonly string[], cwd: string): RunResult {
  try {
    const stdout = execFileSync(bin, [...args], { cwd, encoding: "utf8" });
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
      return execText(command.bin, command.args, cwd);
    },
    worktreeAdd: async (path, branch) => {
      await Promise.resolve();
      execFileSync("git", [...worktreeAddArgs(path, branch)], { cwd: process.cwd() });
      // A fresh worktree has no node_modules (gitignored) — install so the re-run gates have their deps.
      execFileSync("vp", ["install"], { cwd: path });
    },
    worktreeRemove: async (path) => {
      await Promise.resolve();
      execFileSync("git", [...worktreeRemoveArgs(path)], { cwd: process.cwd() });
    },
  };
}
