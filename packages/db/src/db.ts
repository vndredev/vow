import { columnType, createTableSql, defaultValue } from "./schema.ts";
import { DatabaseSync } from "node:sqlite";
import type { ReadonlyVow } from "@vow/core";
import { defined } from "./guard.ts";

/**
 * The data layer — a local SQLite DB (`node:sqlite`) shared by the browser studio (via the dev API) and
 * the node MCP/agent. One table per entity; records are plain JSON objects (`id` + one key per field),
 * the same shape the views bind to. Validation lives a layer up — the generated `create<Name>` (runtime
 * forms) and the MCP studio (required-presence, select-option, reference, and unknown-key checks before
 * a write). This layer only maps JS values to/from SQLite (boolean to/from INTEGER), fills absent fields
 * with their defaults, and enforces a column allow-list — it never validates a value it is handed.
 */

export type Row = Record<string, unknown>;

/** A value that may be absent — the explicit name for `T | undefined` across the read seams. */
type Maybe<T> = T | undefined;

/** A row read but never written — the read-only view every value-mapping helper accepts. */
type ReadRow = Readonly<Row>;

/** A JS value SQLite can store directly — every column round-trips through one of these (and it is the
 *  only kind of value this layer ever binds, so the statement surface takes it directly). */
type Storable = string | number;

/** The outcome of a write — `changes` counts the rows touched (the only field this layer reads). */
interface RunResult {
  readonly changes: number | bigint;
}

/** A prepared statement, narrowed to the read-only method surface this layer uses (so the strict
 *  `prefer-readonly-parameter-types` rule accepts a DB handle as a parameter). `DatabaseSync`'s
 *  `StatementSync` is structurally assignable to it. */
interface Statement {
  readonly all: (...params: readonly Storable[]) => readonly ReadRow[];
  readonly get: (...params: readonly Storable[]) => Maybe<ReadRow>;
  readonly run: (...params: readonly Storable[]) => RunResult;
}

/** A SQLite handle, narrowed to the read-only `exec` + `prepare` surface this layer uses — so it can be
 *  passed as a parameter under the strict rule wall. `DatabaseSync` is structurally assignable to it. */
export interface Db {
  readonly exec: (sql: string) => void;
  readonly prepare: (sql: string) => Statement;
}

/** The empty string, named so the value-mapping reuses one source for the absent-text default. */
const EMPTY = "";

// --- value mapping (JS <-> SQLite) ---

/** Read a row's `name` column as a string, or the empty string when it is absent or not a string. */
function nameOf(row: ReadRow): string {
  const { name } = row;
  if (typeof name === "string") {
    return name;
  }
  return EMPTY;
}

/** Read a `COUNT(*)` row's `n` column as a number, or zero when it is absent or not a number. */
function countOf(row: ReadRow): number {
  const count = row["n"];
  if (typeof count === "number") {
    return count;
  }
  return 0;
}

/** A record's own `id` when it is a non-empty string, else a freshly minted UUID. */
function idFrom(record: ReadRow): string {
  const { id } = record;
  if (typeof id === "string" && id !== EMPTY) {
    return id;
  }
  return crypto.randomUUID();
}

/** A truthy JS value to SQLite's `1`, anything falsy to `0`. */
function boolToInt(value: unknown): number {
  if (value === true || value === 1 || value === "true") {
    return 1;
  }
  return 0;
}

/** A JS value coerced to a finite number — already a number passes through, else `Number(value)` or 0. */
function toNumber(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    return Number(value);
  }
  return 0;
}

/** A JS value rendered to TEXT — a string passes through, a number/boolean is stringified, else empty. */
function toText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return EMPTY;
}

/** A JS value to its SQLite-storable form (boolean to 0/1, number coerced, else a string). */
function encode(entity: ReadonlyVow, col: string, value: unknown): Storable {
  const field = entity.fields.find((candidate) => candidate.name === col);
  if (field?.type === "boolean") {
    return boolToInt(value);
  }
  if (field?.type === "number") {
    return toNumber(value);
  }
  return toText(value);
}

/** A full record: an `id` (minted if absent) + every field (its default if absent); strays dropped. */
function complete(entity: ReadonlyVow, record: ReadRow): Row {
  const out: Row = { id: idFrom(record) };
  for (const field of entity.fields) {
    out[field.name] = record[field.name] ?? defaultValue(field);
  }
  return out;
}

/** One stored cell to its JS form — an INTEGER for a boolean field becomes a real JS bool. */
function decodeField(type: string, value: unknown): unknown {
  if (type === "boolean") {
    return Boolean(value);
  }
  return value;
}

/** A stored row to a JS record (an INTEGER for a boolean field becomes a real JS bool). */
function decode(entity: ReadonlyVow, row: ReadRow): Row {
  const out: Row = { id: row["id"] };
  for (const field of entity.fields) {
    out[field.name] = decodeField(field.type, row[field.name]);
  }
  return out;
}

/** A stored row decoded to its JS record, or absence passed through when no row was found. */
function decodeMaybe(entity: ReadonlyVow, row: Maybe<ReadRow>): Maybe<Row> {
  if (defined(row)) {
    return decode(entity, row);
  }
  return row;
}

// --- schema helpers ---

/** The existing column names of a table (empty when the table is absent). */
function columnNames(db: Db, slug: string): ReadonlySet<string> {
  const rows: readonly ReadRow[] = db.prepare(`PRAGMA table_info("${slug}")`).all();
  return new Set(rows.map((row) => nameOf(row)));
}

/** Whether a table holds no rows yet — the seed-once guard. */
function isEmpty(db: Db, slug: string): boolean {
  const row: ReadRow = db.prepare(`SELECT COUNT(*) AS n FROM "${slug}"`).get() ?? {};
  return countOf(row) === 0;
}

// --- public API ---

/** Open (or create) the DB at `path`. WAL + a busy timeout let the dev server and the MCP share one file. */
export function openDb(path: string): Db {
  const db = new DatabaseSync(path);
  // A no-op for :memory:, concurrency for a file.
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA busy_timeout = 5000;");
  return db;
}

/** Ensure a table per entity — create if absent, add any field column that's missing (additive only). */
export function migrate(db: Db, entities: readonly ReadonlyVow[]): void {
  for (const entity of entities) {
    db.exec(createTableSql(entity));
    const have = columnNames(db, entity.slug);
    for (const field of entity.fields) {
      if (!have.has(field.name)) {
        db.exec(`ALTER TABLE "${entity.slug}" ADD COLUMN "${field.name}" ${columnType(field)};`);
      }
    }
  }
}

export function insert(db: Db, entity: ReadonlyVow, record: ReadRow): Row {
  const full = complete(entity, record);
  const cols = ["id", ...entity.fields.map((field) => field.name)];
  const placeholders = cols.map(() => "?").join(", ");
  const quoted = cols.map((col) => `"${col}"`).join(", ");
  const sql = `INSERT INTO "${entity.slug}" (${quoted}) VALUES (${placeholders})`;
  db.prepare(sql).run(...cols.map((col) => encode(entity, col, full[col])));
  return full;
}

/** Seed-if-empty from each entity's `## seed` — idempotent (mirrors the old in-memory `seed()`). */
export function bootstrap(db: Db, entities: readonly ReadonlyVow[]): void {
  for (const entity of entities) {
    const { seed } = entity;
    if (defined(seed) && seed.length > 0 && isEmpty(db, entity.slug)) {
      for (const record of seed) {
        insert(db, entity, record);
      }
    }
  }
}

export function list(db: Db, entity: ReadonlyVow): Row[] {
  const rows: readonly ReadRow[] = db.prepare(`SELECT * FROM "${entity.slug}"`).all();
  return rows.map((row) => decode(entity, row));
}

export function get(db: Db, entity: ReadonlyVow, id: string): Maybe<Row> {
  const row: Maybe<ReadRow> = db.prepare(`SELECT * FROM "${entity.slug}" WHERE "id" = ?`).get(id);
  return decodeMaybe(entity, row);
}

/**
 * Patch the known fields of one record by id, returning the stored row (or absence when none matches).
 * The 4-arg shape (db, entity, id, patch) is the seam every caller binds to; grouping the last two would
 * ripple across the dev API + MCP, so the parameter count stays as the public contract.
 */
// eslint-disable-next-line max-params
export function update(db: Db, entity: ReadonlyVow, id: string, patch: ReadRow): Maybe<Row> {
  // The column allow-list: only known fields present in the patch are written.
  const keys = entity.fields.map((field) => field.name).filter((key) => key in patch);
  if (keys.length > 0) {
    const assignments = keys.map((key) => `"${key}" = ?`).join(", ");
    const sql = `UPDATE "${entity.slug}" SET ${assignments} WHERE "id" = ?`;
    db.prepare(sql).run(...keys.map((key) => encode(entity, key, patch[key])), id);
  }
  return get(db, entity, id);
}

export function remove(db: Db, entity: ReadonlyVow, id: string): boolean {
  return db.prepare(`DELETE FROM "${entity.slug}" WHERE "id" = ?`).run(id).changes > 0;
}
