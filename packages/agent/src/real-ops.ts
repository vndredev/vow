/* oxlint-disable consistent-type-specifier-style -- node:events is imported as both a value (`once`) and a type (`EventEmitter`); a separate top-level type import would trip no-duplicate-imports */
import type { AgentOps, Command, RunResult } from "./types.ts";
import { type EventEmitter, once } from "node:events";
import { execFileSync, spawn } from "node:child_process";
import { worktreeAddArgs, worktreeRemoveArgs } from "./dispatch.ts";

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

/** A minimal structural type for a spawned process that can receive a signal — avoiding a direct import of
 *  the full `ChildProcess` type (which would require a mixed type+value import from node:child_process). */
interface KillableProcess {
  readonly kill: (signal?: NodeJS.Signals) => boolean;
}

/** The set of active child processes — populated when a command starts, cleared when it exits.
 *  The SIGTERM/SIGINT handlers kill all tracked children so `vow serve --watch` shutdown does not orphan
 *  `claude -p` agents when the hub is killed or restarted (#683). */
const activeChildren = new Set<KillableProcess>();

/** Terminate all tracked child processes by sending SIGTERM — called from the shutdown signal handlers to
 *  prevent orphaned provider agents when `vow serve --watch` exits (#683). Exported so tests can assert
 *  the kill-on-shutdown contract without actually sending OS signals. */
export function killActiveChildren(): void {
  for (const child of activeChildren) {
    child.kill("SIGTERM");
  }
}

// Kill any in-flight provider spawns on shutdown so `vow serve --watch` restart starts clean (#683).
// No `process.exit` here: `dev.ts`'s SIGTERM/SIGINT handler runs next and initiates the graceful shutdown
// (AbortController → runDev resolves → shutDown → process.exit). Registered with `once` so a second signal
// Reaches the default handler (exit) without re-running killActiveChildren on an already-empty set.
process.once("SIGTERM", killActiveChildren);
process.once("SIGINT", killActiveChildren);

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

/** Extract the exit-code field from an unknown close-event args array — the first element when it is a
 *  number, else 1 (a signal-killed process has no numeric exit code; report it as a non-zero failure).
 *  `events.once("close")` resolves with `unknown[]`; this narrows it without an unsafe cast. */
function closeCode(args: readonly unknown[]): number {
  const [first] = args;
  if (typeof first === "number") {
    return first;
  }
  return 1;
}

/** Extract an error message from an unknown thrown value — the `.message` of an Error, else "unknown error".
 *  Used in the spawn-error catch path where the thrown value is the error event's argument. */
function spawnErrMsg(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "unknown error";
}

/** Structural type for a spawned process with capturable stdio streams. */
interface StreamedChild {
  readonly stdout: NodeJS.ReadableStream | null;
  readonly stderr: NodeJS.ReadableStream | null;
}

/** Attach data-event listeners to stdout/stderr, returning the chunk arrays for later concatenation. */
// oxlint-disable-next-line prefer-readonly-parameter-types -- a Node child's stdout/stderr streams are mutable by nature; the param is only read here (boundary adapter)
function setupChunks(child: Readonly<StreamedChild>): [Buffer[], Buffer[]] {
  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];
  child.stdout?.on("data", (chunk: unknown) => {
    if (Buffer.isBuffer(chunk)) {
      stdoutChunks.push(chunk);
    }
  });
  child.stderr?.on("data", (chunk: unknown) => {
    if (Buffer.isBuffer(chunk)) {
      stderrChunks.push(chunk);
    }
  });
  return [stdoutChunks, stderrChunks];
}

/** Wait for the emitter's close event, returning the exit code on success or the spawn-error message. */
async function awaitClose(
  emitter: Readonly<EventEmitter>,
): Promise<{ ok: true; code: number | undefined } | { ok: false; message: string }> {
  try {
    const closeArgs: unknown[] = await once(emitter, "close");
    return { code: closeCode(closeArgs), ok: true };
  } catch (error) {
    return { message: spawnErrMsg(error), ok: false };
  }
}

/** Build a RunResult from an exit code and captured stdout/stderr chunk arrays. */
function buildRunResult(
  code: number | undefined,
  // oxlint-disable-next-line prefer-readonly-parameter-types -- Buffer is a mutable Node type; concat only reads (boundary adapter)
  stdoutChunks: readonly Buffer[],
  // oxlint-disable-next-line prefer-readonly-parameter-types -- Buffer is a mutable Node type; concat only reads (boundary adapter)
  stderrChunks: readonly Buffer[],
): RunResult {
  const out = Buffer.concat(stdoutChunks).toString("utf8");
  const err = Buffer.concat(stderrChunks).toString("utf8");
  if (code === 0) {
    return { code: 0, output: out };
  }
  let exitCode = 1;
  if (typeof code === "number") {
    exitCode = code;
  }
  const combined = [out, err].filter(Boolean).join("\n");
  return { code: exitCode, output: combined || "unknown error" };
}

/** Run a `command` in `cwd` asynchronously, capturing exit + combined stdout/stderr (its `unsetEnv` stripped
 *  from the child). Uses `spawn` so the child is tracked in `activeChildren` before the first await, and the
 *  SIGTERM/SIGINT handlers can kill it on shutdown (#683). `events.once("close")` suspends until the child
 *  exits; all stdout/stderr data events fire before `close`, so the chunks are complete by then. A spawn
 *  error (ENOENT, permission denied) is caught via the `error` event that `events.once` automatically turns
 *  into a rejected Promise. A failed run resolves (never rejects): the caller decides draft vs. continue. */
async function execText(command: Command, cwd: string): Promise<RunResult> {
  const child = spawn(command.bin, [...command.args], {
    cwd,
    // oxlint-disable-next-line no-process-env -- the parent env to hand (filtered) to the child spawn
    env: childEnv(process.env, command.unsetEnv),
  });
  activeChildren.add(child);
  const [stdoutChunks, stderrChunks] = setupChunks(child);
  const result = await awaitClose(child);
  activeChildren.delete(child);
  if (result.ok) {
    return buildRunResult(result.code, stdoutChunks, stderrChunks);
  }
  return { code: 1, output: result.message };
}

/**
 * The real `AgentOps` — git worktrees + a spawned provider CLI via `spawn`. The thin side-effecting
 * adapter the pure loop runs against; `run` is integration-tested with a harmless command, and the git
 * wrappers reuse the already-tested worktree args. A failed worktree command throws (loud); a failed run
 * resolves with its exit code, so the loop can open a draft PR instead of crashing. The spawned child is
 * tracked in `activeChildren` so the SIGTERM/SIGINT handlers can kill it on shutdown (#683).
 */
export function realOps(): AgentOps {
  return {
    run: execText,
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
