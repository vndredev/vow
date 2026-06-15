import { migratePlan } from "./schema.ts";
import { mkdirSync } from "node:fs";
import { openDb } from "@vow/db";
import path from "node:path";

/**
 * The plan DB's location — `<root>/.vow/plan.db`, beside the entity `data.db` but a separate file (vow's
 * own plan, not user data). `.vow/` is gitignored. `openPlan` resolves, opens, and migrates it — the
 * ready handle the MCP + CLI plan tools bind to.
 */

/** The plan DB file for a project — `<root>/.vow/plan.db`, its directory created on resolve. */
export function planDbPath(root: string): string {
  const target = path.join(root, ".vow", "plan.db");
  mkdirSync(path.dirname(target), { recursive: true });
  return target;
}

/** The committed plan snapshot for a project — `<root>/.vow/plan.jsonl`. Unlike the gitignored `.db` (the
 *  per-machine runtime index), this NDJSON file is git-tracked: the plan is versioned + PR-reviewed like
 *  code, and the `.db` is regenerated from it (plus the live issues) on a fresh clone. */
export function planJsonlPath(root: string): string {
  return path.join(root, ".vow", "plan.jsonl");
}

/** Open (creating + migrating) the project's plan DB — the handle every plan tool binds to. */
export function openPlan(root: string): ReturnType<typeof openDb> {
  const db = openDb(planDbPath(root));
  migratePlan(db);
  return db;
}
