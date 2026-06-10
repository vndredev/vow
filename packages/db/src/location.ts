import { defined } from "./guard.ts";
import { env } from "node:process";
import { mkdirSync } from "node:fs";
import path from "node:path";

/**
 * The local DB file for a project — `<root>/.vow/data.db` by default, or `$VOW_DB_PATH` (so the dev
 * server and the MCP can be pointed at one shared file). The directory is created on first resolve.
 * `.vow/` is gitignored (it also holds WAL `-wal`/`-shm` sidecars).
 */

/** A value that may be absent — the explicit name for `T | undefined` (the env var may be unset). */
type Maybe<T> = T | undefined;

/** The default location, relative to `root` (the WAL `-wal`/`-shm` sidecars sit beside it). */
function defaultPath(root: string): string {
  return path.join(root, ".vow", "data.db");
}

/** The `$VOW_DB_PATH` override resolved against `root`, or the default when it is unset or empty. An
 *  absolute override is taken as-is; a relative one is joined onto `root`. */
function resolveTarget(root: string): string {
  const override: Maybe<string> = env["VOW_DB_PATH"];
  if (!defined(override) || override === "") {
    return defaultPath(root);
  }
  if (path.isAbsolute(override)) {
    return override;
  }
  return path.join(root, override);
}

/** Resolve (creating its directory) the local SQLite file for `root` — the override, else the default. */
export function resolveDbPath(root: string): string {
  const target = resolveTarget(root);
  mkdirSync(path.dirname(target), { recursive: true });
  return target;
}
