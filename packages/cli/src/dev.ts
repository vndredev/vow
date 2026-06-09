import { type ChildProcess, execFileSync, spawn } from "node:child_process";
import { connect } from "node:net";
import { type Readable } from "node:stream";
import { type App, APPS, repoRoot } from "./apps.ts";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Free a TCP port by terminating its LISTEN process (found via `lsof`). Returns whether it killed
    anything; a no-op when the port is free or `lsof` isn't on the system. Clears an orphan before a
    `--strictPort` start, and backs `vow stop`. */
export function freePort(port: number): boolean {
  let pids: number[];
  try {
    pids = execFileSync("lsof", ["-ti", `tcp:${port}`, "-sTCP:LISTEN"], { encoding: "utf8" })
      .split("\n")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n > 0);
  } catch {
    return false; // lsof absent, or nothing listening
  }
  for (const pid of pids) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // already gone
    }
  }
  return pids.length > 0;
}

/** Does something accept TCP on the port — i.e. the dev server is up? */
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

/** Run the apps in the foreground — each `vp dev` is spawned with its output streamed (prefixed with the
    app name) to stdout, and the process stays alive until interrupted, then terminates the children. This
    is how `vow dev` always runs: one process, combined logs — you background it (the harness, `&`, a
    supervisor). An orphan on a fixed port is cleared first. */
export async function runDev(apps: readonly App[]): Promise<void> {
  const children: ChildProcess[] = [];
  for (const app of apps) {
    if (freePort(app.port)) await delay(700); // clear an orphan before --strictPort claims the port
    const tag = `[${app.slug}] `;
    const child = spawn(
      "vp",
      ["dev", `apps/${app.slug}`, "--port", String(app.port), "--strictPort"],
      { cwd: repoRoot(), stdio: ["ignore", "pipe", "pipe"] },
    );
    const relay = (from: Readable | null, to: NodeJS.WriteStream): void => {
      from?.on("data", (chunk: Buffer) => {
        const lines = chunk.toString("utf8").split("\n");
        to.write(
          lines.map((l, i) => (i === lines.length - 1 && l === "" ? "" : tag + l)).join("\n"),
        );
      });
    };
    relay(child.stdout, process.stdout);
    relay(child.stderr, process.stderr);
    children.push(child);
    console.log(`${tag}http://localhost:${app.port}/`);
  }
  const shutdown = (): void => {
    for (const child of children) {
      try {
        child.kill("SIGTERM"); // tear the children down with us
      } catch {
        // already gone
      }
    }
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  await new Promise<void>(() => {}); // stay alive until a signal
}

/** Each app's live status — is its fixed port responding? Registry-free: it simply probes the ports. */
export interface AppStatus {
  readonly slug: string;
  readonly port: number;
  readonly responding: boolean;
}
export async function status(): Promise<AppStatus[]> {
  return Promise.all(
    APPS.map(async (app) => ({
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
