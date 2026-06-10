import { connect } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { execFileSync } from "node:child_process";
import { once } from "node:events";

// How long a TCP probe waits before treating the port as not responding.
const PROBE_TIMEOUT_MS = 400;
// While waiting for a port to release: how many times to poll, and the gap between polls.
const RELEASE_POLL_ATTEMPTS = 20;
const RELEASE_POLL_INTERVAL_MS = 100;
// A final settle after a forced kill, so the port is fully reclaimed before a strict start follows.
const SETTLE_MS = 200;

/** Does something accept TCP on the port — i.e. the dev server is up (or the port is still held)? */
export async function portUp(port: number, timeoutMs: number = PROBE_TIMEOUT_MS): Promise<boolean> {
  // `localhost` resolves ::1 + 127.0.0.1, matching how vite binds the dev server.
  const socket = connect({ host: "localhost", port });
  socket.setTimeout(timeoutMs);
  socket.once("timeout", () => {
    socket.destroy(new Error("timeout"));
  });
  try {
    await once(socket, "connect");
    return true;
  } catch {
    return false;
  } finally {
    socket.destroy();
  }
}

/** The PIDs listening on a TCP port (via `lsof`); `[]` when the port is free or `lsof` is absent. */
function listeners(port: number): readonly number[] {
  try {
    return execFileSync("lsof", ["-ti", `tcp:${port}`, "-sTCP:LISTEN"], { encoding: "utf8" })
      .split("\n")
      .map((line) => Number(line.trim()))
      .filter((pid) => Number.isInteger(pid) && pid > 0);
  } catch {
    // `lsof` absent, or nothing listening.
    return [];
  }
}

/** Send `signal` to every listener on `port`, ignoring already-dead PIDs. */
function signalListeners(port: number, signal: NodeJS.Signals): readonly number[] {
  const pids = listeners(port);
  for (const pid of pids) {
    try {
      process.kill(pid, signal);
    } catch {
      // Already gone.
    }
  }
  return pids;
}

/** Terminate the listeners on a port (SIGTERM each); returns whether any were found. Backs `vow stop`. */
export function freePort(port: number): boolean {
  return signalListeners(port, "SIGTERM").length > 0;
}

/** Poll until the port stops responding, up to `attemptsLeft` times. Recursive (not a loop) so each probe
    is awaited in turn without tripping the parallelize-your-awaits guard. */
async function waitReleased(port: number, attemptsLeft: number): Promise<boolean> {
  if (attemptsLeft <= 0) {
    return false;
  }
  await delay(RELEASE_POLL_INTERVAL_MS);
  if (!(await portUp(port))) {
    return true;
  }
  return waitReleased(port, attemptsLeft - 1);
}

/** Free a port and WAIT until it's actually released — SIGTERM the listeners, poll, then escalate to
    SIGKILL the stubborn. So a `--strictPort` start that follows can't race a slow-releasing orphan. */
export async function ensureFree(port: number): Promise<void> {
  if (!freePort(port)) {
    // Already free.
    return;
  }
  if (await waitReleased(port, RELEASE_POLL_ATTEMPTS)) {
    return;
  }
  // Stubborn — force it, then settle.
  signalListeners(port, "SIGKILL");
  await delay(SETTLE_MS);
}
