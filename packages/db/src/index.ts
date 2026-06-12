/**
 * The data layer — a local SQLite DB (`node:sqlite`) shared by the browser studio (via the dev API) and
 * the node MCP/agent. The schema half (`./schema.ts`) derives driver-agnostic SQL + value mapping from an
 * entity's fields; the executor half (`./db.ts`) runs it under `node:sqlite`; `./location.ts` resolves the
 * project's DB file. Re-exported by name (not `export *`) so the public API is explicit and the barrel
 * never pulls the whole dependency graph.
 */

export type { Db, Row } from "./db.ts";
export type { SqlColumn } from "./types.ts";
export {
  archiveTable,
  assertColumnAbsent,
  assertColumnFree,
  assertNoReferrers,
  assertTableFree,
  assertValuesCovered,
  bootstrap,
  convertColumn,
  get,
  insert,
  list,
  migrate,
  openDb,
  remove,
  renameColumn,
  seedEntity,
  update,
} from "./db.ts";
export { resolveDbPath } from "./location.ts";
export { columnType, createTableSql, defaultValue } from "./schema.ts";
