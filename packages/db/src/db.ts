import { DatabaseSync } from "node:sqlite";
import type { Vow } from "@vow/core";
import { columnType, createTableSql, defaultValue } from "./schema.ts";

/**
 * The data layer — a local SQLite DB (`node:sqlite`) shared by the browser studio (via the dev API) and
 * the node MCP/agent. One table per entity; records are plain JSON objects (`id` + one key per field),
 * the same shape the views bind to. Validation lives in the generated `create<Name>` / the MCP — this
 * layer only maps JS values to/from SQLite (boolean ↔ INTEGER) and enforces a column allow-list.
 */

export type Db = DatabaseSync;
export type Row = Record<string, unknown>;

/** Open (or create) the DB at `path`. WAL + a busy timeout let the dev server and the MCP share one file. */
export function openDb(path: string): Db {
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL;"); // a no-op for :memory:, concurrency for a file
  db.exec("PRAGMA busy_timeout = 5000;");
  return db;
}

/** Ensure a table per entity — create if absent, add any field column that's missing (additive only). */
export function migrate(db: Db, entities: readonly Vow[]): void {
  for (const e of entities) {
    db.exec(createTableSql(e));
    const have = new Set(
      (db.prepare(`PRAGMA table_info("${e.slug}")`).all() as { name: string }[]).map((c) => c.name),
    );
    for (const f of e.fields) {
      if (have.has(f.name)) continue;
      db.exec(`ALTER TABLE "${e.slug}" ADD COLUMN "${f.name}" ${columnType(f)};`);
    }
  }
}

/** Seed-if-empty from each entity's `## seed` — idempotent (mirrors the old in-memory `seed()`). */
export function bootstrap(db: Db, entities: readonly Vow[]): void {
  for (const e of entities) {
    if (!e.seed?.length) continue;
    const { n } = db.prepare(`SELECT COUNT(*) AS n FROM "${e.slug}"`).get() as { n: number };
    if (n > 0) continue;
    for (const record of e.seed) insert(db, e, record);
  }
}

export function list(db: Db, entity: Vow): Row[] {
  return (db.prepare(`SELECT * FROM "${entity.slug}"`).all() as Row[]).map((r) =>
    decode(entity, r),
  );
}

export function get(db: Db, entity: Vow, id: string): Row | undefined {
  const r = db.prepare(`SELECT * FROM "${entity.slug}" WHERE "id" = ?`).get(id) as Row | undefined;
  return r ? decode(entity, r) : undefined;
}

export function insert(db: Db, entity: Vow, record: Row): Row {
  const full = complete(entity, record);
  const cols = ["id", ...entity.fields.map((f) => f.name)];
  const sql = `INSERT INTO "${entity.slug}" (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`;
  db.prepare(sql).run(...cols.map((c) => encode(entity, c, full[c])));
  return full;
}

export function update(db: Db, entity: Vow, id: string, patch: Row): Row | undefined {
  const keys = entity.fields.map((f) => f.name).filter((k) => k in patch); // the column allow-list
  if (keys.length > 0) {
    const sql = `UPDATE "${entity.slug}" SET ${keys.map((k) => `"${k}" = ?`).join(", ")} WHERE "id" = ?`;
    db.prepare(sql).run(...keys.map((k) => encode(entity, k, patch[k])), id);
  }
  return get(db, entity, id);
}

export function remove(db: Db, entity: Vow, id: string): boolean {
  return db.prepare(`DELETE FROM "${entity.slug}" WHERE "id" = ?`).run(id).changes > 0;
}

/** A full record: an `id` (minted if absent) + every field (its default if absent); strays dropped. */
function complete(entity: Vow, record: Row): Row {
  const id = typeof record["id"] === "string" && record["id"] ? record["id"] : crypto.randomUUID();
  const out: Row = { id };
  for (const f of entity.fields) out[f.name] = record[f.name] ?? defaultValue(f);
  return out;
}

/** A JS value → its SQLite-storable form (boolean → 0/1, number coerced, else a string). */
function encode(entity: Vow, col: string, value: unknown): string | number {
  const f = entity.fields.find((x) => x.name === col);
  if (f?.type === "boolean") return value ? 1 : 0;
  if (f?.type === "number") return typeof value === "number" ? value : Number(value ?? 0);
  return value === null || value === undefined ? "" : String(value);
}

/** A stored row → a JS record (an INTEGER for a boolean field → a real JS bool). */
function decode(entity: Vow, row: Row): Row {
  const out: Row = { id: row["id"] };
  for (const f of entity.fields)
    out[f.name] = f.type === "boolean" ? Boolean(row[f.name]) : row[f.name];
  return out;
}
