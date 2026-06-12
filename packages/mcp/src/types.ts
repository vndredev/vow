import type { Db, Row, SqlColumn } from "@vow/db";
import type { Field, ViewNode, Vow } from "@vow/core";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * The package's single type hub. The maximal wall forbids BOTH an inline `type` specifier
 * (consistent-type-specifier-style) AND a separate `import type` from the same module
 * (no-duplicate-imports) — so a file that needs both a value and a pure type from one module has no
 * legal mixed import. We sidestep that by routing every TYPE through this one all-type module: a
 * consumer imports its values from a package + its types from here, so each statement stays pure
 * (all-value or all-type) and is never duplicated.
 */

/** The vow + DB types (re-exported as pure types — values come straight from the packages). */
export type { Field, ViewNode, Vow };
export type { Db, Row, SqlColumn };

/** A value that may be absent — the explicit name for `T | undefined`. */
export type Maybe<T> = T | undefined;

/** A deep-readonly view: every property, at every depth and through arrays, becomes readonly. */
export type DeepReadonly<T> = T extends (infer Item)[]
  ? readonly DeepReadonly<Item>[]
  : T extends readonly (infer Item)[]
    ? readonly DeepReadonly<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
      : T;

/** A vow, read-only to its leaves — the parameter shape every read helper accepts. */
export type ReadonlyVow = DeepReadonly<Vow>;

/** A field, read-only to its leaves. */
export type ReadonlyField = DeepReadonly<Field>;

/** The MCP result envelope a tool returns. */
export type TextResult = CallToolResult;

/** The slice of `McpServer` the register modules use — just tool registration. */
export type Registrar = Pick<McpServer, "registerTool">;

/** A tool's `registerTool` config drawn from the catalogue — its name + description. */
export interface ToolMeta {
  readonly description: string;
  readonly name: string;
}

/** Records each tool name as it is registered — the source for the server <-> catalogue drift check. */
export interface Names {
  /** The names registered so far, in registration order. */
  readonly all: readonly string[];
  /** Record `name` and return its `registerTool` config (name + catalogue description). */
  readonly at: (name: string) => ToolMeta;
}

/** A new entity's spec — the parsed `add_entity` input adapted to the core write API. */
export interface EntitySpec {
  readonly fields: readonly ReadonlyField[];
  readonly intent: string;
  readonly slug: string;
}

/** A new view's spec — the parsed `add_view` input adapted to the core write API. `root` designates the
 *  app's entry page; `title` is the app-shell brand; `shell` is the chrome layout (both on the root). */
export interface ViewSpec {
  readonly intent: string;
  readonly nav: Maybe<ReadonlyVow["nav"]>;
  readonly root: Maybe<boolean>;
  readonly shell: Maybe<ReadonlyVow["shell"]>;
  readonly slug: string;
  readonly title: Maybe<string>;
  readonly view: readonly ViewNode[];
}

/** A new form's spec — the parsed `add_form` input adapted to the core write API. `edit: true` makes it
 *  a singleton editor (pre-loads the entity's latest row + updates it in place). */
export interface FormSpec {
  readonly edit: Maybe<boolean>;
  readonly intent: string;
  readonly nav: Maybe<ReadonlyVow["nav"]>;
  readonly of: string;
  readonly slug: string;
  readonly submit: string;
}

/** A form patch — the parsed `set_form` input (edit `of`/`submit`/`edit` in place). */
export interface FormPatch {
  readonly edit: Maybe<boolean>;
  readonly of: Maybe<string>;
  readonly submit: Maybe<string>;
}

/** A field patch — the parsed `set_field` input (rename · retype · toggle required · edit options/ref). */
export interface FieldPatch {
  readonly name: Maybe<string>;
  readonly options: Maybe<readonly string[]>;
  readonly ref: Maybe<string>;
  readonly required: Maybe<boolean>;
  readonly type: Maybe<ReadonlyField["type"]>;
}

/** A one-field record patch — the parsed `set_record_field` input. */
export interface RecordPatch {
  readonly entity: string;
  readonly field: string;
  readonly id: string;
  readonly value: unknown;
}

/**
 * The structure-mutation seams the studio binds to (built by `structure-deps.ts`) — each a `@vow/db`
 * guard or migration run at the right moment relative to the vow `.md` rewrite, so the vow and the live
 * DB never diverge:
 * - `archiveDropped` — on `removeVow` of an emit entity, archive its table (`_dropped_<slug>`) so a
 *   re-create starts fresh and the dead rows stay recoverable.
 * - `columnTypeOf` — the column type of a field BEFORE a patch (captured for `convertType`).
 * - `convertType` — after a `set_field` retype, rebuild the column with the new type (run AFTER the
 *   rename so it acts on the final column name) — `migrate` never changes a column's type.
 * - `guardAddField` — BEFORE `add_field`, reject an orphaned column of the new name (a prior
 *   `remove_field` is additive at the DB layer) so the new field never adopts the dead data.
 * - `guardCreateEntity` — BEFORE `add_entity`, reject a slug whose orphaned table still holds rows.
 * - `guardOptions` — BEFORE a `set_field` that lands a `select`, reject a shrink that strands a stored
 *   value (run on the OLD column name, before the `.md` moves).
 * - `guardRename` — BEFORE a `set_field` rename, reject a collision with an orphaned column.
 * - `renameField` — after a rename, carry the stored data to the new column name (`migrate` is additive).
 * - `seedFresh` — apply an entity's `## seed` once-ever via the ledger, reporting whether rows landed.
 * - `syncDb` — re-derive the table set from the live entity set after a structure change.
 */
export interface StructureDeps {
  readonly archiveDropped: (slug: string) => void;
  readonly columnTypeOf: (entity: string, field: string) => Maybe<SqlColumn>;
  // eslint-disable-next-line max-params
  readonly convertType: (entity: string, field: string, patch: FieldPatch, was: SqlColumn) => void;
  readonly guardAddField: (entity: string, field: ReadonlyField) => void;
  readonly guardCreateEntity: (slug: string) => void;
  readonly guardOptions: (entity: string, field: string, patch: FieldPatch) => void;
  readonly guardRename: (entity: string, from: string, to: string) => void;
  readonly renameField: (entity: string, from: string, to: string) => void;
  readonly seedFresh: (entity: string) => boolean;
  readonly syncDb: () => void;
}

/** The context `structureDeps` is built over — the shared DB, the app dir, the entity resolver, the resync. */
export interface DepsContext {
  readonly appDir: string;
  readonly db: Db;
  readonly entityOf: (slug: string) => Vow;
  readonly syncDb: () => void;
}

/**
 * The studio backing the MCP server — the resolved app dir, plus the seams every tool needs. It owns
 * the shared SQLite handle privately (never a parameter, so the strict read-only-parameter rule never
 * sees a class instance) and exposes only methods + the app dir. It is the single boundary to
 * `@vow/core` (the vow mutations) and `@vow/db` (the record CRUD): the LLM-facing read-only inputs are
 * adapted to the write APIs in its implementation, in one place.
 */
export interface Studio {
  /** Add an `emit entity` vow + re-derive the DB schema — the new vow's slug. */
  readonly addEntity: (spec: EntitySpec) => string;
  /** Add a field to an entity + re-derive the DB schema. */
  readonly addField: (entity: string, field: ReadonlyField) => void;
  /** Add an `emit form` vow (a bound `## form` over an entity) — the new vow's slug. */
  readonly addForm: (spec: FormSpec) => string;
  /** Add a record to an entity (an id is minted; absent fields get defaults) — the stored row. */
  readonly addRecord: (entity: string, record: Readonly<Row>) => Row;
  /** Add an `emit view` vow — the new vow's slug. */
  readonly addView: (spec: ViewSpec) => string;
  /** The resolved app directory the studio operates on. */
  readonly appDir: string;
  /** Every `emit entity` vow's slug, freshly loaded. */
  readonly entitySlugs: () => readonly string[];
  /** Get one record by id — absent when none. */
  readonly getRecord: (entity: string, id: string) => Maybe<Row>;
  /** One vow by slug — absent when none. */
  readonly getVow: (slug: string) => Maybe<ReadonlyVow>;
  /** List an entity's records. */
  readonly listRecords: (entity: string) => readonly Row[];
  /** Every vow, freshly loaded. */
  readonly listVows: () => readonly ReadonlyVow[];
  /** Remove a field from an entity by name. */
  readonly removeField: (entity: string, field: string) => void;
  /** Remove a record by id — `true` when one was deleted. */
  readonly removeRecord: (entity: string, id: string) => boolean;
  /** Remove a vow (its `.md`). */
  readonly removeVow: (slug: string) => void;
  /** Edit a field on an entity in place + re-derive the DB schema (a rename carries the column data). */
  readonly setField: (entity: string, name: string, patch: FieldPatch) => void;
  /** Edit a form's `of`/`submit`/`edit` in place. */
  readonly setForm: (slug: string, patch: FormPatch) => void;
  /** Set a vow's intent (the `# …` promise). */
  readonly setIntent: (slug: string, intent: string) => void;
  /** Set a vow's nav entry. */
  readonly setNav: (slug: string, nav: ReadonlyVow["nav"]) => void;
  /** Patch one field of a record — the updated row, or absent when none. */
  readonly setRecordField: (patch: RecordPatch) => Maybe<Row>;
  /** Replace an entity's versioned `## seed` records + apply them once-ever via the seed ledger — returns
   *  whether THIS call's rows landed (false on an already-seeded entity, so the LLM never sees a silent no-op). */
  readonly setSeed: (entity: string, seed: readonly Readonly<Row>[]) => boolean;
  /** Replace a vow's `## view` (the page tree) in place. */
  readonly setView: (slug: string, view: readonly ViewNode[]) => void;
  /** Re-derive the DB schema (tables + seed) from the current entity set. */
  readonly syncDb: () => void;
  /** Every `emit view` vow's slug, freshly loaded. */
  readonly viewSlugs: () => readonly string[];
}
