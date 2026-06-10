import type { Field, ViewNode, Vow } from "@vow/core";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Row } from "@vow/db";

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
export type { Row };

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

/** A new view's spec — the parsed `add_view` input adapted to the core write API. */
export interface ViewSpec {
  readonly intent: string;
  readonly nav: Maybe<ReadonlyVow["nav"]>;
  readonly slug: string;
  readonly view: readonly ViewNode[];
}

/** A one-field record patch — the parsed `set_record_field` input. */
export interface RecordPatch {
  readonly entity: string;
  readonly field: string;
  readonly id: string;
  readonly value: unknown;
}

/**
 * The studio backing the MCP server — the resolved app dir, plus the seams every tool needs. It owns
 * the shared SQLite handle privately (never a parameter, so the strict read-only-parameter rule never
 * sees a class instance) and exposes only methods + the app dir. It is the single boundary to
 * `@vow/core` (the vow mutations) and `@vow/db` (the record CRUD): the LLM-facing read-only inputs are
 * adapted to the write APIs in its implementation, in one place.
 */
export interface Studio {
  /** Add a record to an entity (an id is minted; absent fields get defaults) — the stored row. */
  readonly addRecord: (entity: string, record: Readonly<Row>) => Row;
  /** The resolved app directory the studio operates on. */
  readonly appDir: string;
  /** Add an `emit entity` vow + re-derive the DB schema — the new vow's slug. */
  readonly createEntity: (spec: EntitySpec) => string;
  /** Add a field to an entity + re-derive the DB schema. */
  readonly createField: (entity: string, field: ReadonlyField) => void;
  /** Add an `emit view` vow — the new vow's slug. */
  readonly createView: (spec: ViewSpec) => string;
  /** Drop a field from an entity by name. */
  readonly dropField: (entity: string, field: string) => void;
  /** Drop a vow (its `.md`). */
  readonly dropVow: (slug: string) => void;
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
  /** Remove a record by id — `true` when one was deleted. */
  readonly removeRecord: (entity: string, id: string) => boolean;
  /** Set a vow's intent (the `# …` promise). */
  readonly setIntent: (slug: string, intent: string) => void;
  /** Set a vow's nav entry. */
  readonly setNav: (slug: string, nav: ReadonlyVow["nav"]) => void;
  /** Re-derive the DB schema (tables + seed) from the current entity set. */
  readonly syncDb: () => void;
  /** Patch one field of a record — the updated row, or absent when none. */
  readonly updateRecord: (patch: RecordPatch) => Maybe<Row>;
  /** Every `emit view` vow's slug, freshly loaded. */
  readonly viewSlugs: () => readonly string[];
}
