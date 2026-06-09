#!/usr/bin/env -S node --experimental-strip-types
import { resolveApps } from "./apps.ts";
import { build, check, test } from "./basics.ts";
import { followLog, readLog, recordedSlugs, startApp, status, stopApp } from "./dev.ts";

const HELP = `vow — the dev lifecycle + the basics. (The MCP is for LLMs; this is for people.)

  vow dev [app...]     run app(s) managed, in the background (default: studio docs; "all" = every app)
  vow status           which apps are running — port · pid · responding
  vow logs <app> [-f]  print an app's log; -f follows it
  vow stop [app...]    stop app(s) (default: all running)

  vow check            vp check — fmt + lint + typecheck
  vow build [app...]   vp build (default: every app)
  vow test             pnpm -r test

  apps: studio (:5173) · docs (:5174) · starter (:5175)`;

async function dev(names: string[]): Promise<number> {
  const apps = resolveApps(names);
  const entries = await Promise.all(apps.map((app) => startApp(app)));
  apps.forEach((app, i) => {
    const entry = entries[i];
    if (entry !== undefined) {
      console.log(
        `${app.slug.padEnd(8)} http://localhost:${entry.port}/  (pid ${entry.pid} · vow logs ${app.slug} -f)`,
      );
    }
  });
  return 0;
}

async function showStatus(): Promise<number> {
  const all = await status();
  if (all.length === 0) {
    console.log("no apps running — start with: vow dev");
    return 0;
  }
  for (const s of all) {
    const mark = s.responding ? "up" : s.running ? "starting" : "dead";
    console.log(`${s.slug.padEnd(8)} :${s.port}  pid ${String(s.pid).padEnd(7)} ${mark}`);
  }
  return 0;
}

function logs(args: string[]): number {
  const follow = args.includes("-f");
  const slug = args.find((a) => a !== "-f");
  if (slug === undefined) {
    console.error("usage: vow logs <app> [-f]");
    return 1;
  }
  if (follow) {
    followLog(slug); // watchFile keeps the process alive until interrupted
    return -1;
  }
  console.log(readLog(slug) || `no log for ${slug} yet`);
  return 0;
}

function stop(names: string[]): number {
  const targets = names.length > 0 ? names : recordedSlugs();
  if (targets.length === 0) {
    console.log("nothing to stop");
    return 0;
  }
  for (const slug of targets) {
    console.log(stopApp(slug) ? `stopped ${slug}` : `${slug} was not running`);
  }
  return 0;
}

async function main(): Promise<number> {
  const [cmd, ...rest] = process.argv.slice(2);
  switch (cmd) {
    case "dev":
      return dev(rest);
    case "status":
      return showStatus();
    case "logs":
      return logs(rest);
    case "stop":
      return stop(rest);
    case "check":
      return check(rest);
    case "build":
      return build(rest);
    case "test":
      return test(rest);
    case undefined:
    case "help":
    case "-h":
    case "--help":
      console.log(HELP);
      return 0;
    default:
      console.error(`unknown command "${cmd}"\n\n${HELP}`);
      return 1;
  }
}

main().then(
  (code) => {
    if (code >= 0) process.exit(code); // -1 = a long-running command (logs -f); stay alive
  },
  (err: unknown) => {
    console.error(`vow: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  },
);
