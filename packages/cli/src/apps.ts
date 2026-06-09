import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** A runnable dev app: the `apps/<slug>` directory and the fixed port it serves on. */
export interface App {
  readonly slug: string;
  readonly port: number;
}

/** The apps `vow` can run, with **fixed** ports — so URLs and the studio's `/__vow/*` APIs never move. */
export const APPS: readonly App[] = [
  { slug: "studio", port: 5173 },
  { slug: "docs", port: 5174 },
  { slug: "starter", port: 5175 },
];

/** The default set for a bare `vow dev` — the two surfaces worked on day to day. `vow dev all` = every app. */
export const DEFAULT_DEV: readonly string[] = ["studio", "docs"];

/** Resolve a slug to its `App`, or throw a clear error listing the valid apps. */
export function appBySlug(slug: string): App {
  const app = APPS.find((a) => a.slug === slug);
  if (app === undefined) {
    throw new Error(`unknown app "${slug}" — known: ${APPS.map((a) => a.slug).join(", ")}`);
  }
  return app;
}

/** Resolve the named apps: empty → the default dev set; `all` anywhere → every app; else the named apps,
    de-duplicated (so `vow dev docs docs` doesn't spawn two servers on the same `--strictPort`). */
export function resolveApps(names: readonly string[]): readonly App[] {
  if (names.length === 0) return DEFAULT_DEV.map(appBySlug);
  if (names.includes("all")) return APPS;
  const seen = new Set<string>();
  return names
    .filter((n) => {
      if (seen.has(n)) return false;
      seen.add(n);
      return true;
    })
    .map(appBySlug);
}

/** The repo root — walk up from this file to the directory holding `pnpm-workspace.yaml`. */
export function repoRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  while (dir !== dirname(dir)) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    dir = dirname(dir);
  }
  throw new Error("vow: could not find the repo root (no pnpm-workspace.yaml above the CLI)");
}
