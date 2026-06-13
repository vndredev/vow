import type { ReadonlyField, ReadonlyVow, SqlColumn } from "./types.ts";
import { columnType, createTableSql, defaultValue } from "./schema.ts";
import { DatabaseSync } from "node:sqlite";
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

/** The value encoder per SQLite column — INTEGER 0/1 for a boolean, REAL for a number, else TEXT. */
const ENCODERS: Record<SqlColumn, (value: unknown) => Storable> = {
  INTEGER: boolToInt,
  REAL: toNumber,
  TEXT: toText,
};

/** A JS value to its SQLite-storable form, by the field's column affinity (INTEGER 0/1 for a boolean, REAL
 *  for a number, else TEXT) — a stray column with no field is TEXT. */
function encode(entity: ReadonlyVow, col: string, value: unknown): Storable {
  const field = entity.fields.find((candidate) => candidate.name === col);
  if (!defined(field)) {
    return toText(value);
  }
  return ENCODERS[columnType(field)](value);
}

/** A full record: an `id` (minted if absent) + every field (its default if absent); strays dropped. */
function complete(entity: ReadonlyVow, record: ReadRow): Row {
  const out: Row = { id: idFrom(record) };
  for (const field of entity.fields) {
    out[field.name] = record[field.name] ?? defaultValue(field);
  }
  return out;
}

/** One stored cell to its JS form — an INTEGER column (a boolean field) becomes a real JS bool. */
function decodeField(field: ReadonlyField, value: unknown): unknown {
  if (columnType(field) === "INTEGER") {
    return Boolean(value);
  }
  return value;
}

/** A stored row to a JS record (an INTEGER for a boolean field becomes a real JS bool). */
function decode(entity: ReadonlyVow, row: ReadRow): Row {
  const out: Row = { id: row["id"] };
  for (const field of entity.fields) {
    out[field.name] = decodeField(field, row[field.name]);
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

/**
 * Reject an identifier that could break out of a quoted SQL identifier BEFORE it is interpolated into a
 * statement — the data layer's last-line defense against identifier injection. Every table slug and column
 * name reaches the SQL below through `"${name}"` interpolation (node:sqlite binds *values*, never
 * identifiers), so a name carrying a `"` would escape the quotes and graft on arbitrary SQL. A legitimate
 * vow identifier is kebab-case (`^[a-z0-9]+(?:-[a-z0-9]+)*$`, slugs) or camelCase (field names), and the
 * internal names this layer mints (`_vow_meta`, `_dropped_<slug>`, `<name>__vow_convert`) only add `_` —
 * none of which contains a `"`. Callers a layer up (the MCP studio, the generated `create<Name>`) validate
 * against `@vow/core`'s spec, but this guard makes the boundary safe regardless of what a caller forgets:
 * a slug like `x" UNION SELECT … --` is refused HERE, before any `prepare`/`exec`, with a clear error.
 */
export function assertSafeIdentifier(name: string): void {
  if (name.includes('"')) {
    throw new Error(
      `unsafe SQL identifier ${JSON.stringify(name)}: a name may not contain a quote`,
    );
  }
}

/** The existing column names of a table (empty when the table is absent). */
function columnNames(db: Db, slug: string): ReadonlySet<string> {
  assertSafeIdentifier(slug);
  const rows: readonly ReadRow[] = db.prepare(`PRAGMA table_info("${slug}")`).all();
  return new Set(rows.map((row) => nameOf(row)));
}

/** Whether a table holds no rows yet — used by `seedEntity`'s in-transaction race re-check. */
function isEmpty(db: Db, slug: string): boolean {
  assertSafeIdentifier(slug);
  const row: ReadRow = db.prepare(`SELECT COUNT(*) AS n FROM "${slug}"`).get() ?? {};
  return countOf(row) === 0;
}

/** Whether a table exists at all (it has at least the `id` column) — the archive / re-create guard. */
function tableExists(db: Db, slug: string): boolean {
  return columnNames(db, slug).size > 0;
}

/** The seed ledger — one row per entity that has ever been seeded, so seed-once means once-ever (not
 *  "empty now"): a `set_seed` on an already-seeded entity is a no-op, and a user who deletes every record
 *  never has the seed resurrected behind their back. The slug is the primary key; `seeded` is always 1.
 *  Created lazily (the first `seedEntity` makes it) and consulted by `bootstrap` instead of `isEmpty`. */
const META_TABLE = "_vow_meta";

/** Ensure the seed ledger exists — a slug primary key flagging each once-ever-seeded entity. */
function ensureMeta(db: Db): void {
  db.exec(
    `CREATE TABLE IF NOT EXISTS "${META_TABLE}" ("slug" TEXT PRIMARY KEY, "seeded" INTEGER);`,
  );
}

/** Whether `slug` has ever been seeded (a row in the ledger) — the once-ever seed predicate. */
function isSeeded(db: Db, slug: string): boolean {
  ensureMeta(db);
  const row =
    db.prepare(`SELECT COUNT(*) AS n FROM "${META_TABLE}" WHERE "slug" = ?`).get(slug) ?? {};
  return countOf(row) > 0;
}

/** Record `slug` as seeded in the ledger — idempotent (`INSERT OR IGNORE`), called inside the seed txn. */
function markSeeded(db: Db, slug: string): void {
  db.prepare(`INSERT OR IGNORE INTO "${META_TABLE}" ("slug", "seeded") VALUES (?, 1)`).run(slug);
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
    assertSafeIdentifier(entity.slug);
    db.exec(createTableSql(entity));
    const have = columnNames(db, entity.slug);
    for (const field of entity.fields) {
      if (!have.has(field.name)) {
        db.exec(`ALTER TABLE "${entity.slug}" ADD COLUMN "${field.name}" ${columnType(field)};`);
      }
    }
  }
}

/**
 * Throw when a rename target column already exists on `slug` (an orphan a prior `remove_field` left
 * behind — `migrate` never drops a column) — so a caller can guard the collision BEFORE rewriting the
 * vow `.md`, keeping the vow and the DB in step. A no-op when `from`/`to` are equal or the target is free.
 */
// eslint-disable-next-line max-params
export function assertColumnFree(db: Db, slug: string, from: string, to: string): void {
  if (from === to) {
    return;
  }
  if (columnNames(db, slug).has(to)) {
    throw new Error(
      `cannot rename field to "${to}": an orphaned column "${to}" still exists — remove it first`,
    );
  }
}

/**
 * Throw when a column named `name` already exists on `slug` — an orphan a prior `remove_field` left
 * behind (`migrate` never drops a column). The sibling of `assertColumnFree` for the ADD path: an
 * `add_field` of a previously-removed name would otherwise silently adopt the orphan's stored data (and
 * mis-decode every row on a type change), since `migrate` skips a column that already exists. Called
 * BEFORE the field is added to the vow, so the LLM gets an actionable error instead of a silent
 * resurrection. A no-op when the table is absent or the name is free.
 */
export function assertColumnAbsent(db: Db, slug: string, name: string): void {
  if (columnNames(db, slug).has(name)) {
    throw new Error(
      `cannot add field "${name}": an orphaned column "${name}" still exists — remove it first`,
    );
  }
}

/** A SQLite expression rebuilding `from` as the target column type — mirrors the value encoders so a
 *  rebuilt column round-trips exactly as a fresh write would (a TEXT boolean "true"/"1" → INTEGER 1; a
 *  numeric column → REAL; anything → TEXT). Used by `convertColumn` to copy data into the new type. */
const CONVERTERS: Record<SqlColumn, (from: string) => string> = {
  INTEGER: (from) =>
    `CASE WHEN "${from}" IN ('true', '1') OR CAST("${from}" AS REAL) <> 0 THEN 1 ELSE 0 END`,
  REAL: (from) => `CAST("${from}" AS REAL)`,
  TEXT: (from) => `CAST("${from}" AS TEXT)`,
};

/** The SQLite ≥ 3.35 column-rebuild dance — ADD a temp column of the new type, copy via a
 *  type-appropriate CAST, DROP the old, RENAME the temp into place. Called only inside `convertColumn`'s
 *  transaction so a mid-dance failure (a kill or a CAST error) rolls the whole sequence back. */
// eslint-disable-next-line max-params
function rebuildColumn(db: Db, slug: string, name: string, temp: string, toType: SqlColumn): void {
  db.exec(`ALTER TABLE "${slug}" ADD COLUMN "${temp}" ${toType};`);
  db.exec(`UPDATE "${slug}" SET "${temp}" = ${CONVERTERS[toType](name)};`);
  db.exec(`ALTER TABLE "${slug}" DROP COLUMN "${name}";`);
  db.exec(`ALTER TABLE "${slug}" RENAME COLUMN "${temp}" TO "${name}";`);
}

/**
 * Rebuild a field's column with a new declared type, converting the stored data — `migrate` never
 * changes a column's type, so a `set_field` retype must rebuild here or the column keeps its old
 * affinity (a TEXT column re-typed to boolean stores a fresh `false` as "0.0", which decodes back to
 * `true`; probe-verified) AND every existing row mis-decodes. The rebuild runs inside a transaction
 * (BEGIN IMMEDIATE / COMMIT / ROLLBACK, mirroring `seedEntity`): an interrupted or failing retype rolls
 * fully back instead of leaving the original data dropped and an orphaned `<name>__vow_convert` column —
 * a corrupted entity. A no-op when the column is absent (a fresh `migrate` will add it with the right
 * type).
 */
// eslint-disable-next-line max-params
export function convertColumn(db: Db, slug: string, name: string, toType: SqlColumn): void {
  if (!columnNames(db, slug).has(name)) {
    return;
  }
  const temp = `${name}__vow_convert`;
  db.exec("BEGIN IMMEDIATE");
  try {
    rebuildColumn(db, slug, name, temp, toType);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

/** The DISTINCT stored values of one column as strings (the column must exist) — the scan behind
 *  `assertValuesCovered`, kept here so the raw SELECT lives in `@vow/db`, never in the studio. */
function distinctValues(db: Db, table: string, column: string): readonly string[] {
  const rows: readonly ReadRow[] = db
    .prepare(`SELECT DISTINCT "${column}" AS v FROM "${table}" WHERE "${column}" IS NOT NULL`)
    .all();
  return rows.map((row) => toText(row["v"])).filter((value) => value !== EMPTY);
}

/**
 * Throw when a stored value of `column` falls outside `allowed` — the guard for shrinking a `select`'s
 * options: afterward a stranded row holds a value that can no longer be written, the edit form rejects
 * the loaded row, and the control renders no selection. Called BEFORE the vow `.md` is rewritten, on the
 * OLD column name, listing the stored values outside the new set (the `— allowed: …` wording). A no-op
 * when the column is absent or every stored value is covered.
 */
// eslint-disable-next-line max-params
export function assertValuesCovered(
  db: Db,
  table: string,
  column: string,
  allowed: readonly string[],
): void {
  if (!columnNames(db, table).has(column)) {
    return;
  }
  const permitted = new Set(allowed);
  const stranded = distinctValues(db, table, column).filter((value) => !permitted.has(value));
  if (stranded.length > 0) {
    throw new Error(
      `cannot shrink options of "${column}": stored ${stranded.join(", ")} — allowed: ${allowed.join(", ")}`,
    );
  }
}

/**
 * Throw when an entity slug's table already holds rows — an orphan a prior `remove_vow` archived nothing
 * of (the parallel of `assertColumnAbsent` at the table level). A re-`create_entity` of a removed slug
 * would otherwise hit `CREATE TABLE IF NOT EXISTS`, keep the dead table + rows, and skip the new
 * `## seed`. Called BEFORE the vow `.md` is written. A no-op when the table is absent or empty.
 */
export function assertTableFree(db: Db, slug: string): void {
  if (tableExists(db, slug) && !isEmpty(db, slug)) {
    throw new Error(
      `cannot create entity "${slug}": an orphaned table "${slug}" still holds rows — remove it first`,
    );
  }
}

/**
 * Archive an entity's table when its vow is dropped — rename it to `_dropped_<slug>` so the data is
 * recoverable, never hard-dropped (the layer's deliberate never-destroy-data stance: `migrate` never
 * drops a column either). A re-`create_entity` of the same slug then starts from a fresh table and seeds.
 * A no-op when the table is absent. Drops any prior archive of the same slug first (a second drop wins).
 */
export function archiveTable(db: Db, slug: string): void {
  if (!tableExists(db, slug)) {
    return;
  }
  const archive = `_dropped_${slug}`;
  db.exec(`DROP TABLE IF EXISTS "${archive}";`);
  db.exec(`ALTER TABLE "${slug}" RENAME TO "${archive}";`);
  // Clear the seed ledger so a re-created slug seeds fresh (its archived rows live under the new name).
  ensureMeta(db);
  db.prepare(`DELETE FROM "${META_TABLE}" WHERE "slug" = ?`).run(slug);
}

/**
 * Rename a field's column so the stored data follows the rename — `migrate` is strictly additive (it
 * only adds the new name as a fresh empty column and orphans the old one), so a field rename must issue
 * `ALTER TABLE … RENAME COLUMN` here. A no-op when `from`/`to` are equal or the source column is absent.
 * Throws (via `assertColumnFree`) when the target name already exists, so a collision never produces a
 * raw SQLite error. The 4-arg shape (db, slug, from, to) mirrors `update`'s — the seam the studio binds to.
 */
// eslint-disable-next-line max-params
export function renameColumn(db: Db, slug: string, from: string, to: string): void {
  if (from === to || !columnNames(db, slug).has(from)) {
    return;
  }
  assertColumnFree(db, slug, from, to);
  db.exec(`ALTER TABLE "${slug}" RENAME COLUMN "${from}" TO "${to}";`);
}

export function insert(db: Db, entity: ReadonlyVow, record: ReadRow): Row {
  assertSafeIdentifier(entity.slug);
  const full = complete(entity, record);
  const cols = ["id", ...entity.fields.map((field) => field.name)];
  const placeholders = cols.map(() => "?").join(", ");
  const quoted = cols.map((col) => `"${col}"`).join(", ");
  const sql = `INSERT INTO "${entity.slug}" (${quoted}) VALUES (${placeholders})`;
  db.prepare(sql).run(...cols.map((col) => encode(entity, col, full[col])));
  return full;
}

/** Insert every seed row, flag the entity seeded in the ledger, and commit — the write half of a seed
 *  transaction (called only when the in-transaction ledger check said the entity is fresh). */
function commitSeed(db: Db, entity: ReadonlyVow, seed: readonly ReadRow[]): void {
  for (const record of seed) {
    insert(db, entity, record);
  }
  markSeeded(db, entity.slug);
  db.exec("COMMIT");
}

/**
 * Seed every record of one entity inside a transaction — all rows land or none do, and the entity is
 * flagged seeded in the ledger so it never seeds again (once-ever, not "empty now"). `BEGIN IMMEDIATE`
 * takes the write lock up front, then the ledger is re-checked INSIDE the transaction: when two processes
 * (the dev server and the MCP) race to seed a fresh entity, the loser sees the winner's committed flag
 * and seeds nothing, so seed-once stays atomic across handles (seed rows carry no `id`, so a re-seed
 * would otherwise mint fresh UUIDs and duplicate the rows). Returns whether the seed rows were applied
 * (false when the entity was already seeded), so a caller can report a no-op to the LLM.
 */
export function seedEntity(db: Db, entity: ReadonlyVow, seed: readonly ReadRow[]): boolean {
  db.exec("BEGIN IMMEDIATE");
  try {
    if (isSeeded(db, entity.slug)) {
      // Already seeded once-ever (this run or a prior one / the race's winner): seed nothing.
      db.exec("ROLLBACK");
      return false;
    }
    commitSeed(db, entity, seed);
    return true;
  } catch (error) {
    // A mid-loop failure rolls back the rows AND the ledger flag, so the next bootstrap retries the seed.
    db.exec("ROLLBACK");
    throw error;
  }
}

/**
 * Seed each entity's `## seed` once-ever — idempotent via the `_vow_meta` ledger (not "empty now"), so a
 * user who deletes every record never has the seed resurrected on the next structure change / vow.md
 * save. Runs on every mutation; the ledger makes every call after the first a no-op. A CHANGED `## seed`
 * never re-applies (delete `.vow/data.db` to reset).
 */
export function bootstrap(db: Db, entities: readonly ReadonlyVow[]): void {
  for (const entity of entities) {
    const { seed } = entity;
    if (defined(seed) && seed.length > 0 && !isSeeded(db, entity.slug)) {
      seedEntity(db, entity, seed);
    }
  }
}

export function list(db: Db, entity: ReadonlyVow): Row[] {
  assertSafeIdentifier(entity.slug);
  const rows: readonly ReadRow[] = db.prepare(`SELECT * FROM "${entity.slug}"`).all();
  return rows.map((row) => decode(entity, row));
}

export function get(db: Db, entity: ReadonlyVow, id: string): Maybe<Row> {
  assertSafeIdentifier(entity.slug);
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
  assertSafeIdentifier(entity.slug);
  // The column allow-list: only known fields present in the patch are written.
  const keys = entity.fields.map((field) => field.name).filter((key) => key in patch);
  if (keys.length > 0) {
    const assignments = keys.map((key) => `"${key}" = ?`).join(", ");
    const sql = `UPDATE "${entity.slug}" SET ${assignments} WHERE "id" = ?`;
    db.prepare(sql).run(...keys.map((key) => encode(entity, key, patch[key])), id);
  }
  return get(db, entity, id);
}

/** One reference column pointing at the dropped entity — the entity holding it + its field name. */
interface Referrer {
  readonly entity: ReadonlyVow;
  readonly field: string;
}

/** Every `reference(<target>)` field across the live entity set — the columns a `target` id can sit in.
 *  The data-layer mirror of `validateReferences`' field scan: where `validateReferences` checks a
 *  reference points at a real entity, this finds where a real entity's id is pointed AT, so a delete can
 *  refuse to strand them. */
function referrersOf(entities: readonly ReadonlyVow[], target: ReadonlyVow): readonly Referrer[] {
  const found: Referrer[] = [];
  for (const entity of entities) {
    for (const field of entity.fields) {
      if (field.type === "reference" && field.ref === target.slug) {
        found.push({ entity, field: field.name });
      }
    }
  }
  return found;
}

/** The single-row count — the boundary the refusal phrase pluralizes above ("row" -> "rows"). */
const ONE_ROW = 1;

/** "row" for a single referrer, "rows" for many — the pluralized noun in the refusal phrase. */
function rowNoun(count: number): string {
  if (count === ONE_ROW) {
    return "row";
  }
  return "rows";
}

/** How many rows hold `id` in `referrer`'s column — the count behind the referenced-delete refusal. */
function referrerCount(db: Db, referrer: Readonly<Referrer>, id: string): number {
  const { entity, field } = referrer;
  const sql = `SELECT COUNT(*) AS n FROM "${entity.slug}" WHERE "${field}" = ?`;
  return countOf(db.prepare(sql).get(id) ?? {});
}

/** A referrer's blocking phrase (`task.owner (2 rows)`), or `""` when no row holds the id (not blocking). */
function referrerPhrase(db: Db, referrer: Readonly<Referrer>, id: string): string {
  const count = referrerCount(db, referrer, id);
  if (count === 0) {
    return EMPTY;
  }
  return `${referrer.entity.slug}.${referrer.field} (${count} ${rowNoun(count)})`;
}

/**
 * Throw when deleting row `id` of `target` would strand a stored reference to it — the data-layer mirror
 * of `removeVow`'s `validateReferences` (which refuses dropping a referenced *entity*; this refuses
 * dropping a referenced *row*). The write side is carefully guarded against dangling refs (a reference
 * value that matches no target row throws on insert/patch), so a delete must not punch the same hole from
 * the other end: every referrer would point at a now-missing id (display resolves nothing; re-setting the
 * ref throws on the dead id). Scans every `reference(<target>)` column across the live entity set, lists
 * each referencing `entity.field (N rows)`, and refuses with an actionable message. A no-op when no live
 * entity references the target or no row holds the id. Called by BOTH the MCP `removeRecord` and the dev
 * API DELETE — the shared remove path the studio and the generated UI both hit.
 */
// eslint-disable-next-line max-params
export function assertNoReferrers(
  db: Db,
  entities: readonly ReadonlyVow[],
  target: ReadonlyVow,
  id: string,
): void {
  const phrases = referrersOf(entities, target)
    .map((referrer) => referrerPhrase(db, referrer, id))
    .filter((phrase) => phrase !== EMPTY);
  if (phrases.length > 0) {
    throw new Error(
      `cannot delete ${target.slug} "${id}": still referenced by ${phrases.join(", ")} — clear or repoint the reference first`,
    );
  }
}

export function remove(db: Db, entity: ReadonlyVow, id: string): boolean {
  assertSafeIdentifier(entity.slug);
  return db.prepare(`DELETE FROM "${entity.slug}" WHERE "id" = ?`).run(id).changes > 0;
}
