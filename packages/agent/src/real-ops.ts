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
