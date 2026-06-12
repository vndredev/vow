/* oxlint-disable consistent-type-specifier-style -- one import; a separate type import trips no-duplicate-imports */
import { type App, repoRoot, resolveApps } from "./apps.ts";
/* oxlint-enable consistent-type-specifier-style */
import type { Server } from "node:http";
import { mcpHttpServer } from "@vow/mcp/http";
import { once } from "node:events";
import path from "node:path";
import { runDev } from "./dev.ts";

/**
 * `vow serve` — the central LOCAL hub. One supervised front door that brings up the **studio** (operate
 * vow) + the **docs** (and with them the `/__vow/*` control API on the studio's dev server), plus the
 * persistent **MCP channel** over HTTP so any number of agents/clients dock into one always-on server
 * (replacing the stdio-per-editor-session launch). Everything local — no GitHub runner, no Cloudflare; the
 * GitHub Actions stay only as the PR gates. The agent watch-loop mounts onto this same hub next (#490).
 */

// The port the persistent MCP channel listens on — beside the apps (studio 5173 · docs 5174 · starter 5175).
const MCP_PORT = 5176;
// The width the slug column is padded to in the banner.
const SLUG_PAD = 8;

/** The hub's MCP studio dir — the studio app's `app/` tree (the same source a running studio regenerates). */
function hubAppDir(): string {
  return path.join(repoRoot(), "apps", "studio", "app");
}

/** The banner `vow serve` prints — names the local hub and lists each surface's URL (the apps + the MCP
    channel), so one glance shows what is up. Pure, so the line shape is unit-testable. */
export function serveBanner(apps: readonly App[], mcpPort: number): string {
  const urls = apps
    .map((app) => `  ${app.slug.padEnd(SLUG_PAD)} http://localhost:${app.port}/`)
    .join("\n");
  const mcp = `  ${"mcp".padEnd(SLUG_PAD)} http://localhost:${mcpPort}/mcp  (agent channel)`;
  return `vow serve — your local hub (studio · docs · the /__vow control API · the MCP channel)\n${urls}\n${mcp}\n`;
}

/** Close the MCP HTTP server, resolving once it has stopped listening (so shutdown awaits it cleanly). */
// oxlint-disable-next-line prefer-readonly-parameter-types -- the mutable node:http Server is closed here
async function closeMcp(server: Server): Promise<void> {
  const closed = once(server, "close");
  server.close();
  await closed;
}

/** `vow serve [app...]` — run the local hub in the foreground: the persistent MCP channel + the apps
    (default: studio + docs; names override, `all` = every app), reusing `runDev`'s supervised spawn. Stays
    pending until interrupted, then tears the MCP channel + the children down. Background it yourself (the
    harness, `&`, a supervisor) — it is the always-on entry. */
export async function runServe(rest: readonly string[]): Promise<number> {
  const apps = resolveApps(rest);
  const mcp = mcpHttpServer(hubAppDir(), MCP_PORT);
  process.stdout.write(serveBanner(apps, MCP_PORT));
  const code = await runDev(apps);
  await closeMcp(mcp);
  return code;
}
