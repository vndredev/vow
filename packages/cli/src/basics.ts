import { APPS, repoRoot } from "./apps.ts";
import { spawnSync } from "node:child_process";

/** Run a command from the repo root, inheriting stdio; return its exit code. */
function run(cmd: string, args: readonly string[]): number {
  return spawnSync(cmd, [...args], { cwd: repoRoot(), stdio: "inherit" }).status ?? 1;
}

/** `vow check [args]` → `vp check [args]` (fmt + lint + typecheck; forwards flags, e.g. `--fix`). */
export function check(args: readonly string[]): number {
  return run("vp", ["check", ...args]);
}

/** `vow build [app...]` → `vp build apps/<app>` for each (default: every app). Stops at the first failure. */
export function build(slugs: readonly string[]): number {
  let targets = slugs;
  if (targets.length === 0) {
    targets = APPS.map((app) => app.slug);
  }
  for (const slug of targets) {
    const code = run("vp", ["build", `apps/${slug}`]);
    if (code !== 0) {
      return code;
    }
  }
  return 0;
}

/** `vow test` → `pnpm -r test` (per-package, project-local bins) — NOT `vp test`, which can't resolve the
    project-local `jsdom` peer. Encoding the right command is the whole point of the wrapper. */
export function test(args: readonly string[]): number {
  return run("pnpm", ["-r", "test", ...args]);
}
