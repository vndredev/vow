import type { AgentOps, Command, RunResult } from "./types.ts";
/* oxlint-disable consistent-type-specifier-style -- ChildProcess type alongside value imports avoids a duplicate-import violation */
import { type ChildProcess, execFileSync, spawn } from "node:child_process";
/* oxlint-enable consistent-type-specifier-style */
import { worktreeAddArgs, worktreeRemoveArgs } from "./dispatch.ts";
import { defined } from "@vow/core";
import { once } from "node:events";

/** The PIDs of currently-running agent child processes — tracked so `killRunningAgents` can terminate them
 *  on hub shutdown, leaving no orphans from a killed/restarted `vow serve --watch`. */
const agentPids = new Set<number>();

/** Send SIGTERM to every tracked agent child. Best-effort: a process already gone is silently skipped.
 *  Call on hub shutdown so a restart starts clean — no orphan agents still running the prior develop. */
export function killRunningAgents(): void {
  for (const pid of agentPids) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // Already gone.
    }
  }
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

/** The accumulated text streams captured from a child process. */
interface Captured {
  readonly getSpawnError: () => string;
  readonly getStderr: () => string;
  readonly getStdout: () => string;
}

/** Attach stdout/stderr/error listeners to `child`, returning closures over the accumulated text.
 *  Called before awaiting exit so no output is dropped between spawn and close. */
function attachOutputListeners(child: Readonly<ChildProcess>): Captured {
  let stdout = "";
  let stderr = "";
  let spawnError = "";
  child.stdout?.setEncoding("utf8");
  child.stderr?.setEncoding("utf8");
  child.stdout?.on("data", (chunk: string) => {
    stdout += chunk;
  });
  child.stderr?.on("data", (chunk: string) => {
    stderr += chunk;
  });
  child.on("error", (error: Readonly<Error>) => {
    spawnError = error.message;
  });
  return {
    getSpawnError: () => spawnError,
    getStderr: () => stderr,
    getStdout: () => stdout,
  };
}

/** Wait for `child` to close and return its exit code (defaults to 1 on spawn failure).
 *  A spawn failure fires "error" before "close" — spawnError is already set by the listener. */
async function waitForExit(child: Readonly<ChildProcess>): Promise<number> {
  try {
    const closeArgs: unknown[] = await once(child, "close");
    const [rawCode] = closeArgs;
    if (typeof rawCode === "number") {
      return rawCode;
    }
    return 1;
  } catch {
    return 1;
  }
}

/** Build the `RunResult` from the exit code and captured output streams. */
function buildResult(exitCode: number, captured: Captured): RunResult {
  if (exitCode === 0 && captured.getSpawnError() === "") {
    return { code: 0, output: captured.getStdout() };
  }
  const combined = [captured.getStdout(), captured.getStderr(), captured.getSpawnError()]
    .filter(Boolean)
    .join("\n");
  return { code: exitCode, output: combined || "unknown error" };
}

/** Run a `command` in `cwd` asynchronously via `spawn`, capturing exit + stdout+stderr. The PID is tracked
 *  in `agentPids` for the duration so `killRunningAgents` can terminate it on hub shutdown. Using `spawn`
 *  (not `execFileSync`) keeps the event loop alive while the child runs — signal handlers fire promptly
 *  instead of being deferred until the blocking call returns. */
async function execText(command: Command, cwd: string): Promise<RunResult> {
  const child = spawn(command.bin, [...command.args], {
    cwd,
    // oxlint-disable-next-line no-process-env -- the parent env to hand (filtered) to the child spawn
    env: childEnv(process.env, command.unsetEnv),
    stdio: ["ignore", "pipe", "pipe"],
  });
  const { pid } = child;
  if (defined(pid)) {
    agentPids.add(pid);
  }
  const captured = attachOutputListeners(child);
  const exitCode = await waitForExit(child);
  if (defined(pid)) {
    agentPids.delete(pid);
  }
  return buildResult(exitCode, captured);
}

/**
 * The real `AgentOps` — git worktrees + a spawned provider CLI via `spawn`. The thin side-effecting
 * adapter the pure loop runs against; `run` is integration-tested with a harmless command, and the git
 * wrappers reuse the already-tested worktree args. A failed worktree command throws (loud); a failed run
 * is captured as its exit code, so the loop can open a draft PR instead of crashing.
 */
export function realOps(): AgentOps {
  return {
    run: async (command, cwd) => execText(command, cwd),
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
