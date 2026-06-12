/* oxlint-disable consistent-type-specifier-style -- one import; a separate type import trips no-duplicate-imports */
import { type App, resolveApps } from "./apps.ts";
/* oxlint-enable consistent-type-specifier-style */
import { runDev } from "./dev.ts";

/**
 * `vow serve` — the central LOCAL hub. One supervised front door that brings up the **studio** (operate
 * vow) + the **docs**, and with them the `/__vow/*` control API (issues · agent-trigger · db) that rides on
 * the studio's dev server via `@vow/vite-plugin`. Everything local — no GitHub runner, no Cloudflare; the
 * GitHub Actions stay only as the PR gates. This is element 1 of the hub: the persistent MCP channel and
 * the agent watch-loop mount onto this same front door next (#490). For now it reuses `dev.ts`'s spawn /
 * relay / shutdown — `serve` is the elevated, named entry, not a fork of the dev runner.
 */

// The width the slug column is padded to in the banner.
const SLUG_PAD = 8;

/** The banner `vow serve` prints — names the local hub and lists each surface's URL, so one glance shows
    what is up. Pure, so the line shape is unit-testable. */
export function serveBanner(apps: readonly App[]): string {
  const urls = apps
    .map((app) => `  ${app.slug.padEnd(SLUG_PAD)} http://localhost:${app.port}/`)
    .join("\n");
  return `vow serve — your local hub (studio · docs · the /__vow control API)\n${urls}\n`;
}

/** `vow serve [app...]` — run the local hub in the foreground (default: studio + docs; names override, `all`
    = every app), reusing `runDev`'s supervised spawn. Stays pending until interrupted, then tears the
    children down. Background it yourself (the harness, `&`, a supervisor) — it is the always-on entry. */
export async function runServe(rest: readonly string[]): Promise<number> {
  const apps = resolveApps(rest);
  process.stdout.write(serveBanner(apps));
  const code = await runDev(apps);
  return code;
}
