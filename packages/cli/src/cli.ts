#!/usr/bin/env -S node --experimental-strip-types
import { APPS, resolveApps } from "./apps.ts";
import { build, check, test } from "./basics.ts";
import { runDev, status, stopApps } from "./dev.ts";
import { guard } from "./guard.ts";
import { reconcile } from "./reconcile.ts";
import { smoke } from "./smoke.ts";

type App = (typeof APPS)[number];
type Handler = (rest: readonly string[]) => number | Promise<number>;

// The first two argv entries are the node binary and this script; the command starts after them.
const ARGV_OFFSET = 2;
// Width the slug column is padded to in the status table.
const SLUG_PAD = 8;

const HELP = `vow — run the apps + the basics. (The MCP is for LLMs; this is for people.)

  vow dev [app...]     run app(s) in the foreground, streaming combined logs (default: studio docs;
                       "all" = every app). Background it yourself — the harness, \`&\`, a supervisor.
  vow status [app...]  which app ports are responding (default: all)
  vow stop [app...]    stop app(s) — frees their ports (default: all)

  vow check            vp check — fmt + lint + typecheck (forwards flags, e.g. --fix)
  vow build [app...]   vp build (default: every app)
  vow test             pnpm -r test
  vow smoke [app]      boot the dev server + assert the client bundle is browser-safe (default: studio)
  vow guard [--check]  enforce main's protection (PR-only · gate · no bypass); --check reports drift only
  vow reconcile        report backlog drift — open issues a merged PR already closed (retire candidates)

  apps: ${APPS.map((app) => `${app.slug} (:${app.port})`).join(" · ")}`;

// A bare `vow status` (no names) means every app.
function statusTargets(names: readonly string[]): readonly App[] {
  if (names.length === 0) {
    return APPS;
  }
  return resolveApps(names);
}

async function showStatus(names: readonly string[]): Promise<number> {
  for (const entry of await status(statusTargets(names))) {
    let state = "down";
    if (entry.responding) {
      state = "up";
    }
    process.stdout.write(`${entry.slug.padEnd(SLUG_PAD)} :${entry.port}  ${state}\n`);
  }
  return 0;
}

// A bare `vow stop` (no names) means every app.
function stopNames(names: readonly string[]): readonly string[] {
  if (names.length === 0) {
    return ["all"];
  }
  return names;
}

function stop(names: readonly string[]): number {
  const stopped = stopApps(resolveApps(stopNames(names)));
  if (stopped.length === 0) {
    process.stdout.write("nothing was running\n");
    return 0;
  }
  process.stdout.write(`stopped ${stopped.join(", ")}\n`);
  return 0;
}

function showHelp(): number {
  process.stdout.write(`${HELP}\n`);
  return 0;
}

// Foreground — resolves only on a signal — surfaced as the process exit code.
async function dev(rest: readonly string[]): Promise<number> {
  const code = await runDev(resolveApps(rest));
  return code;
}

// The handler for an unrecognized command: print the error + help, exit non-zero.
function unknown(cmd: string): Handler {
  return () => {
    process.stderr.write(`unknown command "${cmd}"\n\n${HELP}\n`);
    return 1;
  };
}

const COMMANDS: Readonly<Record<string, Handler>> = {
  "--help": showHelp,
  "-h": showHelp,
  build,
  check,
  dev,
  guard,
  help: showHelp,
  reconcile,
  smoke,
  status: showStatus,
  stop,
  test,
};

function main(): number | Promise<number> {
  const [first, ...rest] = process.argv.slice(ARGV_OFFSET);
  const cmd = first ?? "help";
  const handler = COMMANDS[cmd] ?? unknown(cmd);
  return handler(rest);
}

// The message to surface for any thrown failure.
function describe(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

try {
  process.exit(await main());
} catch (error: unknown) {
  process.stderr.write(`vow: ${describe(error)}\n`);
  process.exit(1);
}
