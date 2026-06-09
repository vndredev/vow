import { type ChildProcess, execFileSync, spawn } from "node:child_process";
import { connect } from "node:net";
import { type Readable } from "node:stream";
import { type App, APPS, repoRoot } from "./apps.ts";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Does something accept TCP on the port — i.e. the dev server is up (or the port is still held)? */
function portUp(port: number, timeoutMs = 400): Promise<boolean> {
  return new Promise((done) => {
    const socket = connect({ port, host: "localhost" }); // resolves ::1 + 127.0.0.1 (vite binds localhost)
    const finish = (up: boolean): void => {
      socket.destroy();
      done(up);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

/** The PIDs listening on a TCP port (via `lsof`); `[]` when the port is free or `lsof` is absent. */
function listeners(port: number): number[] {
  try {
    return execFileSync("lsof", ["-ti", `tcp:${port}`, "-sTCP:LISTEN"], { encoding: "utf8" })
      .split("\n")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n > 0);
  } catch {
    return []; // lsof absent, or nothing listening
  }
}

/** Terminate the listeners on a port (SIGTERM each); returns whether any were found. Backs `vow stop`. */
export function freePort(port: number): boolean {
  const pids = listeners(port);
  for (const pid of pids) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // already gone
    }
  }
  return pids.length > 0;
}

/** Free a port and WAIT until it's actually released — SIGTERM the listeners, poll, then escalate to
    SIGKILL the stubborn. So a `--strictPort` start that follows can't race a slow-releasing orphan. */
async function ensureFree(port: number): Promise<void> {
  if (!freePort(port)) return; // already free
  for (let i = 0; i < 20; i++) {
    await delay(100);
    if (!(await portUp(port))) return; // released
  }
  for (const pid of listeners(port)) {
    try {
      process.kill(pid, "SIGKILL"); // stubborn — force it
    } catch {
      // gone
    }
  }
  await delay(200);
}

/** Split a buffer into the tagged complete lines (up to the last `\n`) and the held-back partial. Pure,
    so the line-tagging is unit-testable: a chunk boundary in the middle of a line can't double-tag it. */
export function tagComplete(buf: string, tag: string): { out: string; rest: string } {
  const nl = buf.lastIndexOf("\n");
  if (nl === -1) return { out: "", rest: buf }; // no complete line yet — hold it all
  return {
    out: buf.slice(0, nl + 1).replace(/[^\n]+/g, (line) => tag + line), // tag each non-empty line
    rest: buf.slice(nl + 1),
  };
}

/** A line-tagging relay that BUFFERS across `data` chunks (via `tagComplete`), so a line split mid-stream
    is tagged once (whole), never `[app] hel[app] lo`. The remainder is flushed on `end`. */
function relay(from: Readable | null, to: NodeJS.WriteStream, tag: string): void {
  let buf = "";
  from?.on("data", (chunk: Buffer) => {
    const { out, rest } = tagComplete(buf + chunk.toString("utf8"), tag);
    buf = rest;
    if (out !== "") to.write(out);
  });
  from?.on("end", () => {
    if (buf !== "") to.write(`${tag}${buf}\n`);
  });
}

/** SIGTERM a child and await its exit (force SIGKILL after a grace period), so the parent never exits
    while a child — and its grandchildren — still hold ports. */
function stopChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    const force = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        // gone
      }
    }, 2000);
    child.once("exit", () => {
      clearTimeout(force);
      resolve();
    });
    try {
      child.kill("SIGTERM");
    } catch {
      clearTimeout(force);
      resolve();
    }
  });
}

/** Run the apps in the foreground — each `vp dev` is spawned with its output streamed (prefixed) to
    stdout, and the process stays alive until interrupted, then tears the children down (awaiting their
    exit). This is how `vow dev` always runs: one process, combined logs — you background it (the harness,
    `&`, a supervisor). An orphan on a fixed port is cleared and waited out first; a spawn failure (e.g. no
    `vp` on PATH) is reported and stops the session cleanly instead of crashing uncaught. */
export async function runDev(apps: readonly App[]): Promise<void> {
  const children: ChildProcess[] = [];
  let shuttingDown = false;

  async function shutdown(code: number): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;
    await Promise.all(children.map((c) => stopChild(c)));
    process.exit(code);
  }

  for (const app of apps) {
    await ensureFree(app.port); // clear + wait out an orphan before --strictPort claims the port
    const tag = `[${app.slug}] `;
    const child = spawn(
      "vp",
      ["dev", `apps/${app.slug}`, "--port", String(app.port), "--strictPort"],
      { cwd: repoRoot(), stdio: ["ignore", "pipe", "pipe"] },
    );
    relay(child.stdout, process.stdout, tag);
    relay(child.stderr, process.stderr, tag);
    child.on("error", (err) => {
      process.stderr.write(`${tag}failed to start: ${err.message}\n`);
      void shutdown(1); // a broken spawn — stop the rest cleanly
    });
    child.on("exit", (code, signal) => {
      if (!shuttingDown) process.stderr.write(`${tag}exited (${signal ?? code ?? "?"})\n`);
    });
    children.push(child);
    console.log(`${tag}http://localhost:${app.port}/`);
  }

  process.on("SIGINT", () => void shutdown(0));
  process.on("SIGTERM", () => void shutdown(0));
  await new Promise<void>(() => {}); // stay alive until a signal
}

/** Each app's live status — is its fixed port responding? Registry-free: it simply probes the ports. */
export interface AppStatus {
  readonly slug: string;
  readonly port: number;
  readonly responding: boolean;
}
export async function status(apps: readonly App[] = APPS): Promise<AppStatus[]> {
  return Promise.all(
    apps.map(async (app) => ({
      slug: app.slug,
      port: app.port,
      responding: await portUp(app.port),
    })),
  );
}

/** Stop apps by freeing their fixed ports (terminates the listeners). Returns the slugs that had one. */
export function stopApps(apps: readonly App[]): string[] {
  return apps.filter((app) => freePort(app.port)).map((app) => app.slug);
}
