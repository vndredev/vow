/* oxlint-disable consistent-type-specifier-style -- one import; a separate type import trips no-duplicate-imports */
import { type App, repoRoot, resolveApps } from "./apps.ts";
/* oxlint-enable consistent-type-specifier-style */
import { LOOP_IDLE, eventsSseServer, readLoopStatus, writeLoopStatus } from "@vow/observability";
import { autoConfirmed, pruneStaleWorktreesOnStartup, runAuto } from "./agent-auto.ts";
import type { Server } from "node:http";
import { boardLine } from "./agent-run.ts";
import { setTimeout as delay } from "node:timers/promises";
import { mcpHttpServer } from "@vow/mcp/http";
import { once } from "node:events";
import path from "node:path";
import { runDev } from "./dev.ts";

/**
 * `vow serve` — the central LOCAL hub. One supervised front door that brings up the **studio** (operate
 * vow) + the **docs** (and with them the `/__vow/*` control API on the studio's dev server), the persistent
 * **MCP channel** over HTTP (any number of agents/clients dock into one always-on server, replacing the
 * stdio-per-editor-session launch), and — opt-in via `--watch` — the **agent watch-loop** (the always-on
 * self-heal runtime). Everything local — no GitHub runner, no Cloudflare; the GitHub Actions stay only as
 * the PR gates (#490).
 */

// The port the persistent MCP channel listens on — beside the apps (studio 5173 · docs 5174 · starter 5175).
const MCP_PORT = 5176;
// The port the provider-neutral event channel (SSE) streams the observability feed on.
const EVENTS_PORT = 5177;
// The width the slug column is padded to in the banner.
const SLUG_PAD = 8;
// How often the watch loop re-runs an auto spiral (it develops new work as it appears, idling between).
const MS_PER_SECOND = 1000;
const WATCH_INTERVAL_SECONDS = 60;
const WATCH_INTERVAL_MS = WATCH_INTERVAL_SECONDS * MS_PER_SECOND;
// The opted-in `vow agent auto` invocation each watch tick fires (the `--yes` is the #486 live-run gate).
const WATCH_ARGS: readonly string[] = ["auto", "--yes"];

/** The watch loop's state: `off` (no `--watch`), `refuse` (`--watch` without the opt-in), or `run`. */
export type Watch = "off" | "refuse" | "run";

/** Decide the watch state — `--watch` plus the auto opt-in (`--yes` / `VOW_AGENT_AUTO=1`, #486) runs the
    loop; `--watch` alone refuses (the unsupervised loop needs the explicit opt-in); no `--watch` is off.
    Pure, so the gate is unit-testable. */
export function watchDecision(watch: boolean, confirmed: boolean): Watch {
  if (!watch) {
    return "off";
  }
  if (!confirmed) {
    return "refuse";
  }
  return "run";
}

/** The app names in `rest` — the positional args, with the `--flags` (`--watch`, `--yes`, …) dropped so
    `resolveApps` never mistakes a flag for an app slug. */
export function appNames(rest: readonly string[]): readonly string[] {
  return rest.filter((arg) => !arg.startsWith("--"));
}

/** The hub's MCP studio dir — the studio app's `app/` tree (the same source a running studio regenerates). */
function hubAppDir(): string {
  return path.join(repoRoot(), "apps", "studio", "app");
}

/** The watch line for the banner — names whether the agent loop is on, refused (needs the opt-in), or off. */
function watchLine(watch: Watch): string {
  if (watch === "run") {
    return `  ${"agent".padEnd(SLUG_PAD)} watch loop ON — vow agent auto --yes every ${WATCH_INTERVAL_SECONDS}s`;
  }
  if (watch === "refuse") {
    return `  ${"agent".padEnd(SLUG_PAD)} --watch ignored — the loop needs --yes (or VOW_AGENT_AUTO=1)`;
  }
  return `  ${"agent".padEnd(SLUG_PAD)} watch loop off — add --watch --yes to run the self-heal loop`;
}

/** The banner `vow serve` prints — names the local hub and lists each surface's URL (the apps + the MCP
    channel) plus the watch state, so one glance shows what is up. Pure, so the line shape is unit-testable. */
/** The hub's two HTTP channel ports — the MCP channel + the SSE event channel. */
export interface HubPorts {
  readonly events: number;
  readonly mcp: number;
}

export function serveBanner(apps: readonly App[], ports: HubPorts, watch: Watch): string {
  const urls = apps
    .map((app) => `  ${app.slug.padEnd(SLUG_PAD)} http://localhost:${app.port}/`)
    .join("\n");
  const mcp = `  ${"mcp".padEnd(SLUG_PAD)} http://localhost:${ports.mcp}/mcp  (agent channel)`;
  const events = `  ${"events".padEnd(SLUG_PAD)} http://localhost:${ports.events}/events  (observability, SSE)`;
  return `vow serve — your local hub (studio · docs · the /__vow control API · the MCP channel · the event channel)\n${urls}\n${mcp}\n${events}\n${watchLine(watch)}\n`;
}

/** The hub's HTTP servers — the MCP channel + the provider-neutral event channel, both torn down on exit. */
interface HubServers {
  readonly events: Server;
  readonly mcp: Server;
}

/** Start the hub's HTTP servers: the MCP channel (agent → vow tools) + the event channel (vow → any client,
    SSE). Reading the event feed from the repo root (where the agent loop records `.vow/events.jsonl`). */
function startServers(): HubServers {
  return {
    events: eventsSseServer(repoRoot(), EVENTS_PORT),
    mcp: mcpHttpServer(hubAppDir(), MCP_PORT),
  };
}

/** Close one HTTP server, resolving once it has stopped listening (so shutdown awaits it cleanly). */
// oxlint-disable-next-line prefer-readonly-parameter-types -- the mutable node:http Server is closed here
async function closeHttp(server: Server): Promise<void> {
  const closed = once(server, "close");
  server.close();
  await closed;
}

/** Close both hub servers in parallel — the one teardown the hub awaits on shutdown. */
// oxlint-disable-next-line prefer-readonly-parameter-types -- HubServers holds mutable node:http Servers
async function closeServers(servers: HubServers): Promise<void> {
  await Promise.all([closeHttp(servers.mcp), closeHttp(servers.events)]);
}

/** Ignore a promise that handles its own errors — keeps `runServe` from awaiting the background watch loop
    (which runs for the hub's lifetime + catches its own failures). */
// oxlint-disable-next-line prefer-readonly-parameter-types -- a Promise has no readonly form
function ignore(promise: Promise<void>): boolean {
  return promise instanceof Promise;
}

/** Run one opted-in auto spiral, swallowing (logging) a failure so a bad round never tears the hub down. */
async function spiralOnce(): Promise<void> {
  try {
    await runAuto(WATCH_ARGS);
  } catch (error) {
    process.stderr.write(`vow serve: watch spiral failed: ${String(error)}\n`);
  }
}

/** Re-assert the agent loop's `running` status between spirals — the watch DAEMON is on for its whole
    lifetime (spiraling, then idling), but a spiral that reaches a terminal records `running: false` on exit.
    So between spirals the daemon re-marks itself running, preserving the round/backlog/openPrs counts the
    last spiral recorded, so the studio shows the loop is on (idling) rather than blinking off each interval.
    Best-effort (`writeLoopStatus` never throws). */
function markDaemonRunning(cwd: string): void {
  writeLoopStatus(cwd, { ...readLoopStatus(cwd), running: true });
}

/** The always-on agent loop inside the hub: run an auto spiral, then re-run every interval — developing new
    issues as they appear, the daemon staying up between spirals. Stops when `stop` aborts (the hub shutting
    down). The inter-spiral wait is abortable, so shutdown is prompt, not up to a full interval late. The
    awaits are sequential by design (spiral, then wait, then repeat) — the whole point is a serial loop.
    Records the daemon's `running` status to `cwd`'s `.vow/loop-status.json` so the studio observes it on. */
/* oxlint-disable no-await-in-loop -- the watch loop is intentionally serial: one spiral, wait, repeat */
async function watchLoop(cwd: string, stop: Readonly<AbortSignal>): Promise<void> {
  while (!stop.aborted) {
    await spiralOnce();
    markDaemonRunning(cwd);
    try {
      // The resolve value (`true`) is unused — a placeholder so the abort `signal` option can be passed.
      await delay(WATCH_INTERVAL_MS, true, { signal: stop });
    } catch {
      return;
    }
  }
}
/* oxlint-enable no-await-in-loop */

/** Reconcile the Project board once, best-effort — a `gh` hiccup logs and is swallowed, never tearing the
    hub down. A no-op (empty line) when no Project is configured. */
function reconcileOnce(cwd: string): void {
  try {
    const line = boardLine(cwd);
    if (line !== "") {
      process.stdout.write(`vow serve: ${line}\n`);
    }
  } catch (error) {
    process.stderr.write(`vow serve: board reconcile skipped: ${String(error)}\n`);
  }
}

/** The board-status invariant: reconcile the GitHub Project's Status to the studio's derived truth every
    interval — independent of the agent loop, so ANY drift (a raw merge, a manual close, a flaky GitHub
    workflow) is auto-corrected within a tick, never needing a manual `sync_project`. No-op without a
    configured Project; the wait is abortable so shutdown is prompt. */
/* oxlint-disable no-await-in-loop -- a serial reconcile, wait, repeat loop */
async function reconcileLoop(cwd: string, stop: Readonly<AbortSignal>): Promise<void> {
  while (!stop.aborted) {
    reconcileOnce(cwd);
    try {
      await delay(WATCH_INTERVAL_MS, true, { signal: stop });
    } catch {
      return;
    }
  }
}
/* oxlint-enable no-await-in-loop */

/** Start the hub's background loops: the board-status reconcile (ALWAYS — the board invariant), and the
    agent watch-loop when opted in. Marks the loop running at the repo root the instant the daemon starts
    (so the studio shows it on before the first spiral computes counts). Kept out of `runServe` so it stays
    under the statement cap. */
function startLoops(watch: Watch, cwd: string, stop: Readonly<AbortSignal>): void {
  ignore(reconcileLoop(cwd, stop));
  if (watch === "run") {
    // Prune a prior run's leftover `.vow-worktrees/feat-issue-N` BEFORE the first spiral (#681) — else the
    // First round's `git worktree add -B feat/issue-N` hits "branch already used by worktree" on a leftover.
    pruneStaleWorktreesOnStartup(cwd);
    markDaemonRunning(cwd);
    ignore(watchLoop(cwd, stop));
  }
}

/** The running hub's pieces — the resolved apps + watch state, the repo root the loop records under, the
    background HTTP servers, and the abort controller that tears the loops down. Bundled so `runServe` stays
    a thin sequence (resolve, bring up, run, shut down) under the statement cap. */
interface Hub {
  readonly apps: readonly App[];
  readonly root: string;
  readonly servers: HubServers;
  readonly stop: AbortController;
  readonly watch: Watch;
}

/** Resolve the hub from the CLI args — the apps + watch state, the repo root, the started HTTP servers, and a
    fresh abort controller. The one place the hub's pieces come together. */
function resolveHub(rest: readonly string[]): Hub {
  return {
    apps: resolveApps(appNames(rest)),
    root: repoRoot(),
    servers: startServers(),
    stop: new AbortController(),
    watch: watchDecision(rest.includes("--watch"), autoConfirmed(rest)),
  };
}

/** Print the hub banner + start its background loops — the one bring-up step. */
// oxlint-disable-next-line prefer-readonly-parameter-types -- Hub holds the mutable AbortController + Servers
function bringUp(hub: Readonly<Hub>): void {
  process.stdout.write(serveBanner(hub.apps, { events: EVENTS_PORT, mcp: MCP_PORT }, hub.watch));
  startLoops(hub.watch, hub.root, hub.stop.signal);
}

/** Tear the hub down: abort the loops, record the agent loop idle at the repo root (so the studio shows
    autonomy is off the moment the hub stops — a no-op when the watch loop never ran), then close the HTTP
    servers. */
// oxlint-disable-next-line prefer-readonly-parameter-types -- Hub holds the mutable AbortController + Servers
async function shutDown(hub: Readonly<Hub>): Promise<void> {
  hub.stop.abort();
  if (hub.watch === "run") {
    writeLoopStatus(hub.root, { ...LOOP_IDLE, lastRound: new Date().toISOString() });
  }
  await closeServers(hub.servers);
}

/** `vow serve [app...] [--watch [--yes]]` — run the local hub in the foreground: the persistent MCP channel
    + the apps (default: studio + docs; names override, `all` = every app), and — with `--watch --yes` — the
    agent watch-loop in the background. Stays pending until interrupted, then tears the MCP channel + the
    children down. Background it yourself — it is the always-on entry. */
export async function runServe(rest: readonly string[]): Promise<number> {
  const hub = resolveHub(rest);
  bringUp(hub);
  const code = await runDev(hub.apps);
  await shutDown(hub);
  return code;
}
