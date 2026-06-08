import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";

/**
 * The local DB file for a project — `<root>/.vow/data.db` by default, or `$VOW_DB_PATH` (so the dev
 * server and the MCP can be pointed at one shared file). The directory is created on first resolve.
 * `.vow/` is gitignored (it also holds WAL `-wal`/`-shm` sidecars).
 */
export function resolveDbPath(root: string): string {
  const env = process.env["VOW_DB_PATH"];
  const path = env ? (isAbsolute(env) ? env : join(root, env)) : join(root, ".vow", "data.db");
  mkdirSync(dirname(path), { recursive: true });
  return path;
}
