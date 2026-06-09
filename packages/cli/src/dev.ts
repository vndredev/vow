import { type ChildProcess, execFileSync, spawn } from "node:child_process";
import {
  appendFileSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  statSync,
  watchFile,
  writeFileSync,
} from "node:fs";
import { connect } from "node:net";
import { dirname } from "node:path";
import { type App, devDir, logPath, registryPath, repoRoot } from "./apps.ts";

/** One running app, as recorded in the registry (`.vow/dev.json`). */
export interface DevEntry {
  readonly port: number;
  readonly pid: number;
  readonly log: string;
  readonly startedAt: number;
}
type Registry = Record<string, DevEntry>;

function readRegistry(): Registry {
  if (!existsSync(registryPath())) return {};
  try {
    return JSON.parse(readFileSync(registryPath(), "utf8")) as Registry;
  } catch {
    return {};
  }
}
function writeRegistry(reg: Registry): void {
  mkdirSync(devDir(), { recursive: true });
  writeFileSync(registryPath(), `${JSON.stringify(reg, null, 2)}\n`, "utf8");
}

/** Is a process alive? `kill(pid, 0)` throws when it isn't. */
function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Does something accept TCP on the port — i.e. the dev server is actually up, not just the process? */
function portUp(port: number, timeoutMs = 400): Promise<boolean> {
  return new Promise((done) => {
    const socket = connect({ port, host: "localhost" }); // resolves both ::1 + 127.0.0.1 (vite binds localhost)
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

/** Stop one app: terminate its process group (the detached `vp dev` + its vite child), drop it from the
    registry. Returns whether an entry was found. */
export function stopApp(slug: string, reg: Registry = readRegistry()): boolean {
  const entry = reg[slug];
  if (entry === undefined) return false;
  try {
    process.kill(-entry.pid, "SIGTERM"); // negative pid = the whole group (the detached leader)
  } catch {
    // already gone — fine
  }
  delete reg[slug];
  writeRegistry(reg);
  return true;
}

/** Free a TCP port held by an orphan — an unmanaged dev server from a previous run (e.g. one not started
    through `vow dev`). Finds the LISTEN process via `lsof` and SIGTERMs it; returns whether it killed
    anything. A no-op when the port is free or `lsof` isn't on the system. */
function freePort(port: number): boolean {
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Start one app detached — `vp dev apps/<slug> --port <port> --strictPort`, output appended to its log,
    recorded in the registry. Any managed instance is stopped first, and an orphan holding the fixed port
    is cleared (a clean restart, every time). */
export async function startApp(app: App): Promise<DevEntry> {
  stopApp(app.slug); // a managed instance for this slug
  if (freePort(app.port)) await delay(700); // an orphan held the port — let it release before --strictPort
  const log = logPath(app.slug);
  mkdirSync(dirname(log), { recursive: true });
  appendFileSync(log, `\n--- vow dev ${app.slug} :${app.port} ${new Date().toISOString()} ---\n`);
  const out = openSync(log, "a");
  const child: ChildProcess = spawn(
    "vp",
    ["dev", `apps/${app.slug}`, "--port", String(app.port), "--strictPort"],
    { cwd: repoRoot(), detached: true, stdio: ["ignore", out, out] },
  );
  child.unref();
  closeSync(out);
  if (child.pid === undefined) throw new Error(`vow: failed to start ${app.slug}`);
  const entry: DevEntry = { port: app.port, pid: child.pid, log, startedAt: Date.now() };
  const reg = readRegistry();
  reg[app.slug] = entry;
  writeRegistry(reg);
  return entry;
}

/** The live status of every recorded app — process alive + port responding. */
export interface AppStatus {
  readonly slug: string;
  readonly port: number;
  readonly pid: number;
  readonly running: boolean;
  readonly responding: boolean;
}
export async function status(): Promise<AppStatus[]> {
  const reg = readRegistry();
  const out: AppStatus[] = [];
  for (const [slug, e] of Object.entries(reg)) {
    const running = alive(e.pid);
    const responding = running ? await portUp(e.port) : false;
    out.push({ slug, port: e.port, pid: e.pid, running, responding });
  }
  return out;
}

/** Every slug currently in the registry (for `vow stop` with no args). */
export function recordedSlugs(): string[] {
  return Object.keys(readRegistry());
}

/** The tail of an app's log (or "" if none yet). */
export function readLog(slug: string, lines = 40): string {
  if (!existsSync(logPath(slug))) return "";
  return readFileSync(logPath(slug), "utf8").split("\n").slice(-lines).join("\n");
}

/** Stream an app's log: print the recent tail, then follow appends until interrupted. */
export function followLog(slug: string): void {
  const path = logPath(slug);
  process.stdout.write(`${readLog(slug)}\n`);
  let size = existsSync(path) ? statSync(path).size : 0;
  watchFile(path, { interval: 300 }, () => {
    if (!existsSync(path)) return;
    const now = statSync(path).size;
    if (now < size) {
      size = now; // rotated/truncated
      return;
    }
    if (now === size) return;
    const fd = openSync(path, "r");
    const buf = Buffer.alloc(now - size);
    readSync(fd, buf, 0, buf.length, size);
    closeSync(fd);
    process.stdout.write(buf.toString("utf8"));
    size = now;
  });
}
