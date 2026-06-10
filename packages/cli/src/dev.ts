import { APPS, repoRoot } from "./apps.ts";
import { ensureFree, freePort, portUp } from "./ports.ts";
import { once } from "node:events";
import { spawn } from "node:child_process";

// Derived, so no value+type import collides on a single module.
type App = (typeof APPS)[number];

/** The read-only slice of a child's output stream that the line relay consumes. A real Node `Readable` is
    structurally assignable, so the strict `prefer-readonly-parameter-types` rule is satisfied. */
interface OutStream {
  readonly setEncoding: (encoding: "utf8") => unknown;
  readonly on: (event: "data" | "end", listener: (chunk: string) => void) => unknown;
}

/** The read-only slice of a destination stream the relay writes tagged lines to. */
interface LineSink {
  readonly write: (chunk: string) => unknown;
}

// How long to wait after SIGTERM before forcing SIGKILL on a child.
const STOP_GRACE_MS = 2000;

/** Split a buffer into the tagged complete lines (up to the last `\n`) and the held-back partial. Pure,
    so the line-tagging is unit-testable: a chunk boundary in the middle of a line can't double-tag it. */
export function tagComplete(
  buf: string,
  tag: string,
): { readonly out: string; readonly rest: string } {
  const nl = buf.lastIndexOf("\n");
  if (nl === -1) {
    // No complete line yet — hold it all.
    return { out: "", rest: buf };
  }
  return {
    // Tag each non-empty line.
    out: buf.slice(0, nl + 1).replaceAll(/[^\n]+/gu, (line) => tag + line),
    rest: buf.slice(nl + 1),
  };
}

/** A line-tagging relay that BUFFERS across `data` chunks (via `tagComplete`), so a line split mid-stream
    is tagged once (whole), never `[app] hel[app] lo`. The remainder is flushed on `end`. */
function relay(from: OutStream | null, to: LineSink, tag: string): void {
  let buf = "";
  from?.setEncoding("utf8");
  from?.on("data", (chunk) => {
    const { out, rest } = tagComplete(buf + chunk, tag);
    buf = rest;
    if (out !== "") {
      to.write(out);
    }
  });
  from?.on("end", () => {
    if (buf !== "") {
      to.write(`${tag}${buf}\n`);
    }
  });
}

/** A running child, controlled through a closure — so the mutable `ChildProcess` never leaks across a
    function boundary (where the strict readonly-parameter rule would reject it). `stop` SIGTERMs the child
    and resolves once it exits (escalating to SIGKILL after a grace period); the timer is unref'd, so it
    never keeps the process alive past the child's own exit. */
interface Session {
  readonly stop: () => Promise<void>;
}

/** Spawn one app's `vp dev` with its output streamed (prefixed) to stdout, wiring exit + error handlers.
    A spawn error (e.g. no `vp` on PATH) triggers `onFail`, which tears the session down cleanly. */
function spawnApp(
  app: App,
  onFail: (code: number) => void,
  isShuttingDown: () => boolean,
): Session {
  const tag = `[${app.slug}] `;
  const child = spawn(
    "vp",
    ["dev", `apps/${app.slug}`, "--port", String(app.port), "--strictPort"],
    { cwd: repoRoot(), stdio: ["ignore", "pipe", "pipe"] },
  );
  relay(child.stdout, process.stdout, tag);
  relay(child.stderr, process.stderr, tag);
  child.on("error", (error: Readonly<Error>) => {
    process.stderr.write(`${tag}failed to start: ${error.message}\n`);
    onFail(1);
  });
  child.on("exit", (code, exitSignal) => {
    if (!isShuttingDown()) {
      process.stderr.write(`${tag}exited (${exitSignal ?? code ?? "?"})\n`);
    }
  });
  process.stdout.write(`${tag}http://localhost:${app.port}/\n`);
  return {
    async stop() {
      if (child.exitCode !== null || child.signalCode !== null) {
        return;
      }
      const grace = AbortSignal.timeout(STOP_GRACE_MS);
      const onGrace = (): void => {
        try {
          child.kill("SIGKILL");
        } catch {
          // Gone.
        }
      };
      grace.addEventListener("abort", onGrace, { once: true });
      try {
        child.kill("SIGTERM");
      } catch {
        // Gone.
      }
      await once(child, "exit");
      grace.removeEventListener("abort", onGrace);
    },
  };
}

/** Clear + wait out any orphans on every app's fixed port, in parallel, before a strict start claims them. */
async function clearPorts(apps: readonly App[]): Promise<void> {
  await Promise.all(
    apps.map(async (app) => {
      await ensureFree(app.port);
    }),
  );
}

/** Stop every session — SIGTERM each child and await its exit, in parallel. */
async function stopAll(sessions: readonly Session[]): Promise<void> {
  await Promise.all(
    sessions.map(async (session) => {
      await session.stop();
    }),
  );
}

/** Run the apps in the foreground — each `vp dev` is spawned with combined, prefixed logs, and the call
    stays pending until interrupted, then tears the children down (awaiting their exit) and resolves with
    the exit code for the caller to surface. This is how `vow dev` always runs: one process, combined logs
    — you background it (the harness, `&`, a supervisor). Orphans on the fixed ports are cleared and waited
    out first; a spawn failure stops the session cleanly instead of crashing uncaught. */
export async function runDev(apps: readonly App[]): Promise<number> {
  const done = new AbortController();
  const requestShutdown = (code: number): void => {
    if (!done.signal.aborted) {
      done.abort(code);
    }
  };
  await clearPorts(apps);
  const sessions = apps.map((app) => spawnApp(app, requestShutdown, () => done.signal.aborted));
  process.on("SIGINT", () => {
    requestShutdown(0);
  });
  process.on("SIGTERM", () => {
    requestShutdown(0);
  });
  await once(done.signal, "abort");
  await stopAll(sessions);
  return Number(done.signal.reason);
}

/** Each app's live status — is its fixed port responding? Registry-free: it simply probes the ports. */
export interface AppStatus {
  readonly slug: string;
  readonly port: number;
  readonly responding: boolean;
}

export async function status(apps: readonly App[] = APPS): Promise<readonly AppStatus[]> {
  const probed = await Promise.all(
    apps.map(async (app) => ({
      port: app.port,
      responding: await portUp(app.port),
      slug: app.slug,
    })),
  );
  return probed;
}

/** Stop apps by freeing their fixed ports (terminates the listeners). Returns the slugs that had one. */
export function stopApps(apps: readonly App[]): readonly string[] {
  return apps.filter((app) => freePort(app.port)).map((app) => app.slug);
}
