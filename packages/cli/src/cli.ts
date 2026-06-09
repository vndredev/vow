#!/usr/bin/env -S node --experimental-strip-types
import { APPS, resolveApps } from "./apps.ts";
import { build, check, test } from "./basics.ts";
import { runDev, status, stopApps } from "./dev.ts";

const HELP = `vow — run the apps + the basics. (The MCP is for LLMs; this is for people.)

  vow dev [app...]     run app(s) in the foreground, streaming combined logs (default: studio docs;
                       "all" = every app). Background it yourself — the harness, \`&\`, a supervisor.
  vow status [app...]  which app ports are responding (default: all)
  vow stop [app...]    stop app(s) — frees their ports (default: all)

  vow check            vp check — fmt + lint + typecheck (forwards flags, e.g. --fix)
  vow build [app...]   vp build (default: every app)
  vow test             pnpm -r test

  apps: ${APPS.map((a) => `${a.slug} (:${a.port})`).join(" · ")}`;

async function showStatus(names: string[]): Promise<number> {
  const apps = names.length > 0 ? resolveApps(names) : APPS; // bare `vow status` = every app
  for (const s of await status(apps)) {
    console.log(`${s.slug.padEnd(8)} :${s.port}  ${s.responding ? "up" : "down"}`);
  }
  return 0;
}

function stop(names: string[]): number {
  const stopped = stopApps(resolveApps(names.length > 0 ? names : ["all"]));
  console.log(stopped.length > 0 ? `stopped ${stopped.join(", ")}` : "nothing was running");
  return 0;
}

async function main(): Promise<number> {
  const [cmd, ...rest] = process.argv.slice(2);
  switch (cmd) {
    case "dev":
      await runDev(resolveApps(rest)); // foreground — returns only on a signal
      return 0;
    case "status":
      return showStatus(rest);
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
  (code) => process.exit(code),
  (err: unknown) => {
    console.error(`vow: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  },
);
