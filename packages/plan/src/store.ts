import type { Db, Row } from "@vow/db";
import { NONE, defined } from "@vow/core";
import type { PlanDep, PlanEvent, PlanItem, PlanOrigin, PlanSession, PlanStatus } from "./types.ts";
import { canTransition } from "./lifecycle.ts";

/** A value that may be absent — the local name for `T | undefined` across the read seams. */
type Maybe<T> = T | undefined;

/**
 * The plan store — CRUD over the fixed plan tables, mirroring `@vow/db`'s value-mapping discipline: the
 * statement surface binds only `string | number`, so an absent `issue`/`pillar`/`closedAt` stores its
 * default (`0`/`""`) and decodes back to absence — never a bound NULL. `setStatus` is the one guarded
 * write: it refuses an illegal lifecycle move (vow owns the lifecycle, so the move is law, not a label).
 */

/** A value the statement surface binds directly — every column round-trips through one of these. */
type Storable = string | number;

/** A row read but never written — the read-only view every decode helper accepts (under the strict rule). */
type ReadRow = Readonly<Row>;

/** The empty string — the absent-text default + the "no pillar/closedAt/note" sentinel on decode. */
const EMPTY = "";

/** The 0 an absent issue/pr stores (real issue + PR numbers are >= 1, so 0 reads back as absence). */
const ABSENT_NUM = 0;

/** The amount a new item's position advances past the current max. */
const ONE = 1;

/** The fields a caller supplies to open a plan item — the rest (id, status, position, timestamps) are
 *  filled by `addItem`. */
export interface PlanItemInput {
  readonly issue?: Maybe<number>;
  readonly origin?: Maybe<PlanOrigin>;
  readonly pillar?: Maybe<string>;
  readonly priority?: Maybe<number>;
  readonly title: string;
}

// --- value mapping (Row <-> typed) ---

/** A row's `key` column as a string, or `""` when absent/not a string. */
function text(row: ReadRow, key: string): string {
  const value = row[key];
  if (typeof value === "string") {
    return value;
  }
  return EMPTY;
}

/** A row's `key` column as a number, or `0` when absent/not a number. */
function int(row: ReadRow, key: string): number {
  const value = row[key];
  if (typeof value === "number") {
    return value;
  }
  return ABSENT_NUM;
}

/** The known plan statuses — the allow-list a stored string narrows against (no `as`). */
const STATUSES: readonly PlanStatus[] = [
  "backlog",
  "blocked",
  "doing",
  "done",
  "parked",
  "ready",
  "review",
];

/** The known origins — the allow-list a stored string narrows against. */
const ORIGINS: readonly PlanOrigin[] = ["external", "internal", "user"];

/** A stored string narrowed to a `PlanStatus`, defaulting to `backlog` on an unknown value. */
function toStatus(value: string): PlanStatus {
  for (const status of STATUSES) {
    if (status === value) {
      return status;
    }
  }
  return "backlog";
}

/** A stored string narrowed to a `PlanOrigin`, defaulting to `internal` on an unknown value. */
function toOrigin(value: string): PlanOrigin {
  for (const origin of ORIGINS) {
    if (origin === value) {
      return origin;
    }
  }
  return "internal";
}

/** The optional `issue` fragment — present only when a positive number is given. */
function optIssue(value: Maybe<number>): { issue?: number } {
  if (typeof value === "number" && value > ABSENT_NUM) {
    return { issue: value };
  }
  return {};
}

/** The optional `pillar` fragment — present only when a non-empty string is given. */
function optPillar(value: Maybe<string>): { pillar?: string } {
  if (typeof value === "string" && value !== EMPTY) {
    return { pillar: value };
  }
  return {};
}

/** The optional `closedAt` fragment — present only when a non-empty timestamp is given. */
function optClosedAt(value: string): { closedAt?: string } {
  if (value !== EMPTY) {
    return { closedAt: value };
  }
  return {};
}

/** The optional `pr` fragment — present only when a positive number is given. */
function optPr(value: number): { pr?: number } {
  if (value > ABSENT_NUM) {
    return { pr: value };
  }
  return {};
}

/** The optional `note` fragment — present only when a non-empty string is given. */
function optNote(value: string): { note?: string } {
  if (value !== EMPTY) {
    return { note: value };
  }
  return {};
}

/** A stored row to a `PlanItem` — the optional columns decode to absence, never `0`/`""`. */
function decodeItem(row: ReadRow): PlanItem {
  return {
    createdAt: text(row, "createdAt"),
    id: text(row, "id"),
    origin: toOrigin(text(row, "origin")),
    position: int(row, "position"),
    priority: int(row, "priority"),
    status: toStatus(text(row, "status")),
    title: text(row, "title"),
    updatedAt: text(row, "updatedAt"),
    ...optIssue(int(row, "issue")),
    ...optPillar(text(row, "pillar")),
    ...optClosedAt(text(row, "closedAt")),
  };
}

/** Now as an ISO-8601 UTC timestamp — every plan write stamps `updatedAt` (and `createdAt`) with it. */
function nowIso(): string {
  return new Date().toISOString();
}

// --- items ---

/** The next `position` — one past the current max, so a fresh item sorts last within its priority. */
function nextPosition(db: Db): number {
  const row = db.prepare(`SELECT COALESCE(MAX("position"), 0) AS n FROM "plan_item"`).get() ?? {};
  return int(row, "n") + ONE;
}

/** The item columns, in the fixed insert order. */
const ITEM_COLS: readonly string[] = [
  "id",
  "issue",
  "title",
  "status",
  "pillar",
  "priority",
  "position",
  "origin",
  "createdAt",
  "updatedAt",
  "closedAt",
];

/** The bindable values of an item, in `ITEM_COLS` order — absent optionals as their `0`/`""` default. */
function itemValues(item: PlanItem): readonly Storable[] {
  return [
    item.id,
    item.issue ?? ABSENT_NUM,
    item.title,
    item.status,
    item.pillar ?? EMPTY,
    item.priority,
    item.position,
    item.origin,
    item.createdAt,
    item.updatedAt,
    item.closedAt ?? EMPTY,
  ];
}

/** Insert a fully-formed item (the write half of `addItem`; also the snapshot restore, which carries each
 *  item's stored id rather than minting a new one). */
export function insertItem(db: Db, item: PlanItem): void {
  const quoted = ITEM_COLS.map((col) => `"${col}"`).join(", ");
  const placeholders = ITEM_COLS.map(() => "?").join(", ");
  db.prepare(`INSERT INTO "plan_item" (${quoted}) VALUES (${placeholders})`).run(
    ...itemValues(item),
  );
}

/** Clear the plan's items + dependency edges — the write half of a snapshot restore (it replaces the
 *  whole plan from `plan.jsonl`). Sessions + events (per-machine runtime state) are left untouched. */
export function clearPlan(db: Db): void {
  db.prepare(`DELETE FROM "plan_dep"`).run();
  db.prepare(`DELETE FROM "plan_item"`).run();
}

/** Open a new plan item — minted id, `backlog` status, next position, stamped — and store it. */
export function addItem(db: Db, input: Readonly<PlanItemInput>): PlanItem {
  const now = nowIso();
  const item: PlanItem = {
    createdAt: now,
    id: crypto.randomUUID(),
    origin: input.origin ?? "internal",
    position: nextPosition(db),
    priority: input.priority ?? ABSENT_NUM,
    status: "backlog",
    title: input.title,
    updatedAt: now,
    ...optIssue(input.issue),
    ...optPillar(input.pillar),
  };
  insertItem(db, item);
  return item;
}

/** One item by id, or `NONE` when none matches. */
export function getItem(db: Db, id: string): Maybe<PlanItem> {
  const row = db.prepare(`SELECT * FROM "plan_item" WHERE "id" = ?`).get(id);
  if (defined(row)) {
    return decodeItem(row);
  }
  return NONE;
}

/** Every plan item, by ascending position. */
export function listItems(db: Db): PlanItem[] {
  const rows = db.prepare(`SELECT * FROM "plan_item" ORDER BY "position"`).all();
  return rows.map((row) => decodeItem(row));
}

/** Set an item's `priority` (re-rank), stamping `updatedAt`. Returns the stored item, or `NONE`. */
export function setPriority(db: Db, id: string, priority: number): Maybe<PlanItem> {
  db.prepare(`UPDATE "plan_item" SET "priority" = ?, "updatedAt" = ? WHERE "id" = ?`).run(
    priority,
    nowIso(),
    id,
  );
  return getItem(db, id);
}

/** The `closedAt` to store for a status — the stamp when entering `done`, else cleared. */
function closedAtFor(status: PlanStatus): string {
  if (status === "done") {
    return nowIso();
  }
  return EMPTY;
}

/**
 * Transition an item to `status` — the one guarded write. Refuses an illegal lifecycle move (vow owns
 * the lifecycle), stamps `updatedAt`, and sets `closedAt` when entering `done`. Returns the stored item;
 * `NONE` when the id is unknown.
 */
export function setStatus(db: Db, id: string, status: PlanStatus): Maybe<PlanItem> {
  const item = getItem(db, id);
  if (!defined(item)) {
    return NONE;
  }
  if (!canTransition(item.status, status)) {
    throw new Error(`illegal plan transition: ${item.status} -> ${status} (item ${id})`);
  }
  db.prepare(
    `UPDATE "plan_item" SET "status" = ?, "updatedAt" = ?, "closedAt" = ? WHERE "id" = ?`,
  ).run(status, nowIso(), closedAtFor(status), id);
  return getItem(db, id);
}

/** Mark an item done directly — the external-close path (its bound GitHub issue closed, so the work IS
 *  done): the external truth wins, so this skips the lifecycle check `setStatus` enforces. Stamps both
 *  `updatedAt` and `closedAt`. Returns the stored item, or `NONE`. */
export function setItemDone(db: Db, id: string): Maybe<PlanItem> {
  const now = nowIso();
  db.prepare(
    `UPDATE "plan_item" SET "status" = ?, "updatedAt" = ?, "closedAt" = ? WHERE "id" = ?`,
  ).run("done", now, now, id);
  return getItem(db, id);
}

/** Remove an item — true when a row was deleted. */
export function removeItem(db: Db, id: string): boolean {
  return db.prepare(`DELETE FROM "plan_item" WHERE "id" = ?`).run(id).changes > 0;
}

// --- deps (the DAG) ---

/** Add a dependency edge — `item` blocked by `dependsOn`. Idempotent (the pair is the primary key). */
export function addDep(db: Db, item: string, dependsOn: string): void {
  db.prepare(`INSERT OR IGNORE INTO "plan_dep" ("item", "dependsOn") VALUES (?, ?)`).run(
    item,
    dependsOn,
  );
}

/** Every dependency edge — the DAG the ready-queue walks. */
export function listDeps(db: Db): PlanDep[] {
  const rows = db.prepare(`SELECT * FROM "plan_dep"`).all();
  return rows.map((row) => ({ dependsOn: text(row, "dependsOn"), item: text(row, "item") }));
}

/** Remove a dependency edge — true when one was deleted. */
export function removeDep(db: Db, item: string, dependsOn: string): boolean {
  return (
    db.prepare(`DELETE FROM "plan_dep" WHERE "item" = ? AND "dependsOn" = ?`).run(item, dependsOn)
      .changes > 0
  );
}

// --- sessions (the live agent claim) ---

/** A stored row to a `PlanSession` — `pr` decodes to absence when no positive number is stored. */
function decodeSession(row: ReadRow): PlanSession {
  return {
    branch: text(row, "branch"),
    item: text(row, "item"),
    startedAt: text(row, "startedAt"),
    worktree: text(row, "worktree"),
    ...optPr(int(row, "pr")),
  };
}

/** Open (or replace) the live session for an item — one claim per item (the item is the primary key). */
export function openSession(db: Db, session: Readonly<PlanSession>): void {
  db.prepare(
    `INSERT OR REPLACE INTO "plan_session" ("item", "branch", "worktree", "pr", "startedAt") VALUES (?, ?, ?, ?, ?)`,
  ).run(
    session.item,
    session.branch,
    session.worktree,
    session.pr ?? ABSENT_NUM,
    session.startedAt,
  );
}

/** The live session for an item, or `NONE` when the item carries no claim. */
export function getSession(db: Db, item: string): Maybe<PlanSession> {
  const row = db.prepare(`SELECT * FROM "plan_session" WHERE "item" = ?`).get(item);
  if (defined(row)) {
    return decodeSession(row);
  }
  return NONE;
}

/** Every live session — what the studio's Now view + the loop's reconcile read. */
export function listSessions(db: Db): PlanSession[] {
  const rows = db.prepare(`SELECT * FROM "plan_session"`).all();
  return rows.map((row) => decodeSession(row));
}

/** Release an item's session (the agent finished, or vow reconciled an orphan) — true when one existed. */
export function closeSession(db: Db, item: string): boolean {
  return db.prepare(`DELETE FROM "plan_session" WHERE "item" = ?`).run(item).changes > 0;
}

// --- events (the audit trail) ---

/** The fields one recorded event carries (beyond its minted id + ts). */
export interface PlanEventInput {
  readonly item: string;
  readonly kind: string;
  readonly note: string;
}

/** Record one event on an item's trail — minted id + `ts`. */
export function recordEvent(db: Db, event: Readonly<PlanEventInput>): void {
  db.prepare(
    `INSERT INTO "plan_event" ("id", "item", "ts", "kind", "note") VALUES (?, ?, ?, ?, ?)`,
  ).run(crypto.randomUUID(), event.item, nowIso(), event.kind, event.note);
}

/** A stored row to a `PlanEvent` — `note` decodes to absence when empty. */
function decodeEvent(row: ReadRow): PlanEvent {
  return {
    id: text(row, "id"),
    item: text(row, "item"),
    kind: text(row, "kind"),
    ts: text(row, "ts"),
    ...optNote(text(row, "note")),
  };
}

/** An item's audit trail, oldest first. */
export function listEvents(db: Db, item: string): PlanEvent[] {
  const rows = db.prepare(`SELECT * FROM "plan_event" WHERE "item" = ? ORDER BY "ts"`).all(item);
  return rows.map((row) => decodeEvent(row));
}
