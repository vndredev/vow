import { existsSync } from "node:fs";
import path from "node:path";

/** A runnable dev app: the `apps/<slug>` directory and the fixed port it serves on. */
export interface App {
  readonly slug: string;
  readonly port: number;
}

/** The apps `vow` can run, with **fixed** ports — so URLs and the studio's `/__vow/*` APIs never move. */
export const APPS: readonly App[] = [
  { port: 5173, slug: "studio" },
  { port: 5174, slug: "docs" },
  { port: 5175, slug: "starter" },
];

/** The serve hub's own ports beside the apps — the persistent MCP channel + the events SSE stream. Shaped
    as `App`s so `stopApps` frees them the same way it frees the app ports. */
export const MCP_PORT = 5176;
export const EVENTS_PORT = 5177;
export const HUB_APPS: readonly App[] = [
  { port: MCP_PORT, slug: "mcp" },
  { port: EVENTS_PORT, slug: "events" },
];

/** The default set for a bare `vow dev` — the two surfaces worked on day to day. `vow dev all` = every app. */
export const DEFAULT_DEV: readonly string[] = ["studio", "docs"];

/** Resolve a slug to its `App`, or throw a clear error listing the valid apps. */
export function appBySlug(slug: string): App {
  for (const app of APPS) {
    if (app.slug === slug) {
      return app;
    }
  }
  const known = APPS.map((app) => app.slug).join(", ");
  throw new Error(`unknown app "${slug}" — known: ${known}`);
}

/** Resolve the named apps: empty → the default dev set; `all` anywhere → every app; else the named apps,
    de-duplicated (so `vow dev docs docs` doesn't spawn two servers on the same `--strictPort`). */
export function resolveApps(names: readonly string[]): readonly App[] {
  if (names.length === 0) {
    return DEFAULT_DEV.map((slug) => appBySlug(slug));
  }
  if (names.includes("all")) {
    return APPS;
  }
  const seen = new Set<string>();
  return names
    .filter((name) => {
      if (seen.has(name)) {
        return false;
      }
      seen.add(name);
      return true;
    })
    .map((name) => appBySlug(name));
}

/** Whether `names` is a full command — a bare invocation (no app) or an explicit `all`, the case where a
    `vow stop` also tears the serve hub down. Mirrors `resolveApps`'s empty/`all` handling. */
export function isFullStop(names: readonly string[]): boolean {
  return names.length === 0 || names.includes("all");
}

/** The repo root — walk up from this file to the directory holding `pnpm-workspace.yaml`. */
export function repoRoot(): string {
  let dir = import.meta.dirname;
  while (dir !== path.dirname(dir)) {
    if (existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  throw new Error("could not find the repo root (no pnpm-workspace.yaml above the CLI)");
}
