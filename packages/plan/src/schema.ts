import type { Db } from "@vow/db";

/**
 * The plan tables — vow's OWN fixed schema (unlike the per-entity tables `@vow/db` builds from fields).
 * `plan_item` holds the rich structure; `plan_dep` is the dependency DAG; `plan_session` is a live agent
 * claim (one per item); `plan_event` is the audit trail. Created idempotently on open. Boolean-free, so
 * the simple TEXT/INTEGER affinity round-trips cleanly.
 */
const PLAN_TABLES: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS "plan_item" (
  "id" TEXT PRIMARY KEY,
  "issue" INTEGER,
  "title" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "pillar" TEXT,
  "priority" INTEGER NOT NULL,
  "position" INTEGER NOT NULL,
  "origin" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL,
  "closedAt" TEXT
);`,
  `CREATE TABLE IF NOT EXISTS "plan_dep" (
  "item" TEXT NOT NULL,
  "dependsOn" TEXT NOT NULL,
  PRIMARY KEY ("item", "dependsOn")
);`,
  `CREATE TABLE IF NOT EXISTS "plan_session" (
  "item" TEXT PRIMARY KEY,
  "branch" TEXT NOT NULL,
  "worktree" TEXT NOT NULL,
  "pr" INTEGER,
  "startedAt" TEXT NOT NULL
);`,
  `CREATE TABLE IF NOT EXISTS "plan_event" (
  "id" TEXT PRIMARY KEY,
  "item" TEXT NOT NULL,
  "ts" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "note" TEXT
);`,
];

/** Create the plan tables if absent — idempotent, run on open (mirrors `@vow/db`'s `migrate`). */
export function migratePlan(db: Db): void {
  for (const sql of PLAN_TABLES) {
    db.exec(sql);
  }
}
