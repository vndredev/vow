import type {
  Db,
  Field,
  Maybe,
  ReadonlyField,
  ReadonlyVow,
  Row,
  Studio,
  TextResult,
  Vow,
} from "./types.ts";
import {
  addEntity,
  addField,
  addForm,
  addView,
  defined,
  isEmit,
  loadVows,
  removeField,
  removeVow,
  setField,
  setForm,
  setIntent,
  setNav,
  setSeed,
  setView,
} from "@vow/core/node";
import {
  assertColumnFree,
  bootstrap,
  get,
  insert,
  list,
  migrate,
  openDb,
  remove,
  renameColumn,
  resolveDbPath,
  update,
} from "@vow/db";
import path from "node:path";
import process from "node:process";

/**
 * The studio backing the MCP server (its interface lives in `types.ts`) — the resolved app dir + the
 * seams every tool needs. It owns the shared SQLite handle privately (never a parameter, so the strict
 * read-only-parameter rule never sees a class instance) and is the single boundary to `@vow/core` (the
 * vow mutations) and `@vow/db` (the record CRUD): the LLM-facing read-only inputs are adapted to the
 * write APIs here, in one place. A structure write lands in `app/*.vow.md`; a data write lands in
 * `.vow/data.db` — the same file the dev server / D1 serves. `syncDb` keeps the table set in step with
 * the live entity set after a structure change.
 */

const ARGV_OFFSET = 2;
const JSON_INDENT = 2;

/** The `options` of a `select` field as a fresh mutable array fragment — empty when absent. */
function fieldOptions(field: ReadonlyField): { options?: string[] } {
  if (defined(field.options)) {
    return { options: [...field.options] };
  }
  return {};
}

/** The `ref` of a `reference` field as a fragment — empty when absent. */
function fieldRef(field: ReadonlyField): { ref?: string } {
  if (defined(field.ref)) {
    return { ref: field.ref };
  }
  return {};
}

/** Rebuild a read-only field as the mutable `Field` the core write API takes. */
function toField(field: ReadonlyField): Field {
  return {
    name: field.name,
    required: field.required,
    type: field.type,
    ...fieldOptions(field),
    ...fieldRef(field),
  };
}

/** The structure slice of the studio — the vow mutations. */
type StructureSeam = Pick<
  Studio,
  | "createEntity"
  | "createField"
  | "createForm"
  | "createView"
  | "dropField"
  | "dropVow"
  | "editField"
  | "editForm"
  | "editSeed"
  | "editView"
  | "setIntent"
  | "setNav"
>;

/** The seams the structure mutations bind to: a schema-resync thunk + a column-rename (run after a
 *  field rename, so the stored data follows the new column name before the schema is re-derived) + a
 *  pre-write collision guard (run BEFORE the vow `.md` is rewritten, so a rename onto an orphaned column
 *  throws an actionable error while the vow and DB are still in step). */
interface StructureDeps {
  readonly guardRename: (entity: string, from: string, to: string) => void;
  readonly renameField: (entity: string, from: string, to: string) => void;
  readonly syncDb: () => void;
}

/** The create / drop half of the structure seam — adds a vow + re-derives the DB (for an entity). */
type CreateSeam = Pick<
  StructureSeam,
  "createEntity" | "createField" | "createForm" | "createView" | "dropField" | "dropVow"
>;

/** The edit half of the structure seam — patches an existing vow (intent · nav · view · form · seed · field). */
type EditSeam = Pick<
  StructureSeam,
  "editField" | "editForm" | "editSeed" | "editView" | "setIntent" | "setNav"
>;

/** Build the create / drop methods over the app dir + the schema-resync thunk. */
function createSeam(appDir: string, syncDb: () => void): CreateSeam {
  return {
    createEntity: (spec) => {
      const fields = spec.fields.map((field: ReadonlyField) => toField(field));
      const vow = addEntity(appDir, { fields, intent: spec.intent, slug: spec.slug });
      syncDb();
      return vow.slug;
    },
    createField: (entity, field) => {
      addField(appDir, entity, toField(field));
      syncDb();
    },
    createForm: (spec) =>
      addForm(appDir, {
        edit: spec.edit,
        intent: spec.intent,
        nav: spec.nav,
        of: spec.of,
        slug: spec.slug,
        submit: spec.submit,
      }).slug,
    createView: (spec) =>
      addView(appDir, {
        intent: spec.intent,
        nav: spec.nav,
        root: spec.root,
        shell: spec.shell,
        slug: spec.slug,
        title: spec.title,
        view: spec.view,
      }).slug,
    dropField: (entity, field) => {
      removeField(appDir, entity, field);
    },
    dropVow: (slug) => {
      removeVow(appDir, slug);
    },
  };
}

/** Build the edit methods over the app dir + the schema-resync + column-rename seams. */
function editSeam(appDir: string, deps: StructureDeps): EditSeam {
  const { guardRename, renameField, syncDb } = deps;
  return {
    editField: (entity, name, patch) => {
      // Guard the rename collision BEFORE the vow `.md` is rewritten — a rename onto an orphaned column
      // (one a prior `remove_field` left behind) must throw here, not as a raw SQLite error after the
      // `.md` already moved, so the vow and DB never diverge.
      guardRename(entity, name, patch.name ?? name);
      // Validate + rewrite the vow (it throws on a bad patch, leaving the DB untouched).
      setField(appDir, entity, name, patch);
      // Carry the column data across a rename — `migrate` is additive and would orphan the old column.
      renameField(entity, name, patch.name ?? name);
      syncDb();
    },
    editForm: (slug, patch) => {
      setForm(appDir, slug, patch);
    },
    editSeed: (entity, seed) => {
      setSeed(appDir, entity, seed);
      syncDb();
    },
    editView: (slug, view) => {
      setView(appDir, slug, view);
    },
    setIntent: (slug, intent) => {
      setIntent(appDir, slug, intent);
    },
    setNav: (slug, nav) => {
      setNav(appDir, slug, nav);
    },
  };
}

/** Build the full structure seam — the create / drop half + the edit half, over the same app dir. */
function structureSeam(appDir: string, deps: StructureDeps): StructureSeam {
  return { ...createSeam(appDir, deps.syncDb), ...editSeam(appDir, deps) };
}

/** The display-name field of an entity — its first text field, else `id` (mirrors how a reference cell
 *  resolves an id back to a name: the target's first text field). */
export function labelField(entity: ReadonlyVow): string {
  const named = entity.fields.find((field: ReadonlyField) => field.type === "text");
  if (defined(named)) {
    return named.name;
  }
  return "id";
}

/** The target slug of a `reference` field named `field` on `entity` — `""` when `field` isn't a reference. */
export function referenceRef(entity: ReadonlyVow, field: string): string {
  const found = entity.fields.find((candidate: ReadonlyField) => candidate.name === field);
  if (defined(found) && found.type === "reference" && defined(found.ref)) {
    return found.ref;
  }
  return "";
}

/** The id of the row whose display field equals `value` — `""` when none matches. */
export function idByLabel(rows: readonly Readonly<Row>[], label: string, value: string): string {
  const match = rows.find((row: Readonly<Row>) => String(row[label]) === value);
  if (defined(match) && typeof match["id"] === "string") {
    return match["id"];
  }
  return "";
}

/** The target id a reference value points to — an existing id passes through; a name is matched against
 *  the target's display field. Throws when neither an id nor a name matches. */
function targetId(db: Db, target: ReadonlyVow, value: unknown): string {
  const raw = String(value);
  if (defined(get(db, target, raw))) {
    return raw;
  }
  const id = idByLabel(list(db, target), labelField(target), raw);
  if (id !== "") {
    return id;
  }
  throw new Error(`no ${target.slug} with id or ${labelField(target)} "${raw}"`);
}

/** The keys a record may carry on an entity — `id` (minted/matched) plus every declared field name. */
function knownKeys(entity: ReadonlyVow): readonly string[] {
  return ["id", ...entity.fields.map((field: ReadonlyField) => field.name)];
}

/** Throw on any record key that is not `id` or a declared field — so a typo is caught, never dropped
 *  silently (the db layer copies only known fields, so an unknown key would otherwise vanish). */
function rejectUnknownKeys(entity: ReadonlyVow, keys: readonly string[]): void {
  const known = knownKeys(entity);
  const stray = keys.find((key) => !known.includes(key));
  if (defined(stray)) {
    throw new Error(`unknown field "${stray}" on ${entity.slug} — known: ${known.join(", ")}`);
  }
}

/** Throw when a `select` field's value is not one of its declared options (listing the allowed set) — so
 *  a value outside the options never lands as a blank/broken generated select. A non-select field, or a
 *  select with no options declared, passes through untouched. */
function rejectBadOption(entity: ReadonlyVow, field: string, value: unknown): void {
  const found = entity.fields.find((candidate: ReadonlyField) => candidate.name === field);
  if (!defined(found) || found.type !== "select" || !defined(found.options)) {
    return;
  }
  if (!found.options.includes(String(value))) {
    const allowed = found.options.join(", ");
    throw new Error(
      `"${String(value)}" is not an option of ${entity.slug}.${field} — allowed: ${allowed}`,
    );
  }
}

/** Throw when a record carries an explicit, already-taken `id` — so a re-run (an LLM re-issuing a call
 *  it thought failed) gets an actionable recovery path, never SQLite's opaque "UNIQUE constraint failed".
 *  An absent or empty `id` (the mint-a-fresh-one path) passes through untouched. */
function rejectDuplicateId(db: Db, entity: ReadonlyVow, record: Readonly<Row>): void {
  const { id } = record;
  if (typeof id !== "string" || id === "") {
    return;
  }
  if (defined(get(db, entity, id))) {
    throw new Error(
      `a ${entity.slug} with id "${id}" already exists — use set_record_field to update it, or omit id to mint a new one`,
    );
  }
}

/** Throw when a `required` field is absent (or set to an empty string) on a full record — so the MCP
 *  author path never silently defaults a missing required value, as the running app's zod factory
 *  rejects it. Mirrors `create<Name>`'s required check; a one-field patch never runs this. */
function rejectMissingRequired(entity: ReadonlyVow, record: Readonly<Row>): void {
  const missing = entity.fields.find(
    (field: ReadonlyField) => field.required && (record[field.name] ?? "") === "",
  );
  if (defined(missing)) {
    throw new Error(`required field "${missing.name}" is missing on ${entity.slug}`);
  }
}

/** Resolve one reference field's value (a name → the target id; a non-reference value passes through). */
type ResolveField = (entity: ReadonlyVow, field: string, value: unknown) => unknown;

/** A record with every field run through `resolveField` — so a reference passed as a display name on
 *  insert resolves to the target id (no dangling ref), exactly as a one-field patch does on update.
 *  Unknown keys throw first (a typo never resolves to a silently dropped column); a `select` value
 *  outside its options throws too (never stored as a blank/broken select). */
function resolveRecord(
  resolveField: ResolveField,
  entity: ReadonlyVow,
  record: Readonly<Row>,
): Row {
  rejectUnknownKeys(entity, Object.keys(record));
  const resolved: Row = {};
  for (const [field, value] of Object.entries(record)) {
    rejectBadOption(entity, field, value);
    resolved[field] = resolveField(entity, field, value);
  }
  return resolved;
}

/** The read + record-data half of the studio — every method that doesn't write a vow. */
type DataSeam = Pick<
  Studio,
  | "addRecord"
  | "entitySlugs"
  | "getRecord"
  | "getVow"
  | "listRecords"
  | "listVows"
  | "removeRecord"
  | "updateRecord"
  | "viewSlugs"
>;

/** The closures the data seam binds to — the entity resolver + the reference-name resolver. */
interface DataDeps {
  readonly entityOf: (slug: string) => Vow;
  readonly resolveRef: ResolveField;
}

/** Build the read + record-data methods over the app dir + the shared DB + the entity / reference seams. */
// eslint-disable-next-line max-params
function dataSeam(appDir: string, db: Db, deps: DataDeps): DataSeam {
  const { entityOf, resolveRef } = deps;
  return {
    addRecord: (entity, record) => {
      const target = entityOf(entity);
      rejectDuplicateId(db, target, record);
      rejectMissingRequired(target, record);
      return insert(db, target, resolveRecord(resolveRef, target, record));
    },
    entitySlugs: () =>
      loadVows(appDir)
        .filter((vow: ReadonlyVow) => isEmit(vow, "entity"))
        .map((vow: ReadonlyVow) => vow.slug),
    getRecord: (entity, id) => get(db, entityOf(entity), id),
    getVow: (slug) => loadVows(appDir).find((vow: ReadonlyVow) => vow.slug === slug),
    listRecords: (entity) => list(db, entityOf(entity)),
    listVows: () => loadVows(appDir),
    removeRecord: (entity, id) => remove(db, entityOf(entity), id),
    updateRecord: (patch) => {
      const entity = entityOf(patch.entity);
      const resolved = resolveRecord(resolveRef, entity, { [patch.field]: patch.value });
      return update(db, entity, patch.id, resolved);
    },
    viewSlugs: () =>
      loadVows(appDir)
        .filter((vow: ReadonlyVow) => isEmit(vow, "view"))
        .map((vow: ReadonlyVow) => vow.slug),
  };
}

/** Resolve the app dir from `VOW_APP_DIR` or the first CLI argument — absent when neither is set. */
export function resolveAppDir(): Maybe<string> {
  const raw = process.env["VOW_APP_DIR"] ?? process.argv[ARGV_OFFSET];
  if (defined(raw) && raw !== "") {
    return path.resolve(raw);
  }
  return raw;
}

/** Build the studio: open the shared DB, wire the seams, sync the schema once. */
export function openStudio(appDir: string): Studio {
  const db = openDb(resolveDbPath(path.dirname(appDir)));
  const entities = (): Vow[] =>
    loadVows(appDir).filter((vow: ReadonlyVow) => isEmit(vow, "entity"));
  const entityOf = (slug: string): Vow => {
    const live = entities();
    const found = live.find((vow: ReadonlyVow) => vow.slug === slug);
    if (defined(found)) {
      return found;
    }
    // List the known entities (the established `… — known: …` convention) — this is the hottest MCP error
    // Path (it backs every data + field tool), so a slug typo must offer a recovery, never dead-end.
    const known = live.map((vow: ReadonlyVow) => vow.slug).join(", ");
    throw new Error(`no entity "${slug}" — known: ${known}`);
  };
  const resolveRef = (entity: ReadonlyVow, field: string, value: unknown): unknown => {
    const ref = referenceRef(entity, field);
    if (ref === "") {
      return value;
    }
    return targetId(db, entityOf(ref), value);
  };
  const syncDb = (): void => {
    const live = entities();
    migrate(db, live);
    bootstrap(db, live);
  };
  // Carry a field's stored data across a rename — `entityOf` asserts the target exists (the table = slug).
  const renameField = (entity: string, from: string, to: string): void => {
    renameColumn(db, entityOf(entity).slug, from, to);
  };
  // Reject a rename onto an orphaned column BEFORE the vow `.md` is rewritten (keeps vow + DB in step).
  const guardRename = (entity: string, from: string, to: string): void => {
    assertColumnFree(db, entityOf(entity).slug, from, to);
  };
  syncDb();
  return {
    appDir,
    syncDb,
    ...dataSeam(appDir, db, { entityOf, resolveRef }),
    ...structureSeam(appDir, { guardRename, renameField, syncDb }),
  };
}

/** Wrap a plain string in the MCP text envelope. */
export function text(body: string): TextResult {
  return { content: [{ text: body, type: "text" }] };
}

/** Wrap any value as pretty JSON in the MCP text envelope. */
export function json(data: unknown): TextResult {
  return text(JSON.stringify(data, (_key: string, value: unknown) => value, JSON_INDENT));
}
