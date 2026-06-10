import type { Field, Maybe, ReadonlyField, ReadonlyVow, Studio, TextResult, Vow } from "./types.ts";
import {
  addEntity,
  addField,
  addView,
  defined,
  loadVows,
  removeField,
  removeVow,
  setIntent,
  setNav,
} from "@vow/core/node";
import {
  bootstrap,
  get,
  insert,
  list,
  migrate,
  openDb,
  remove,
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

const fulfilledAs = (vow: ReadonlyVow, as: "entity" | "view"): boolean =>
  vow.fulfills?.kind === "emit" && vow.fulfills.as === as;

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
  "createEntity" | "createField" | "createView" | "dropField" | "dropVow" | "setIntent" | "setNav"
>;

/** Build the structure methods over the app dir + a schema-resync thunk (run after an entity change). */
function structureSeam(appDir: string, syncDb: () => void): StructureSeam {
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
    createView: (spec) =>
      addView(appDir, { intent: spec.intent, nav: spec.nav, slug: spec.slug, view: spec.view })
        .slug,
    dropField: (entity, field) => {
      removeField(appDir, entity, field);
    },
    dropVow: (slug) => {
      removeVow(appDir, slug);
    },
    setIntent: (slug, intent) => {
      setIntent(appDir, slug, intent);
    },
    setNav: (slug, nav) => {
      setNav(appDir, slug, nav);
    },
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
    loadVows(appDir).filter((vow: ReadonlyVow) => fulfilledAs(vow, "entity"));
  const entityOf = (slug: string): Vow => {
    const found = entities().find((vow: ReadonlyVow) => vow.slug === slug);
    if (defined(found)) {
      return found;
    }
    throw new Error(`no entity "${slug}"`);
  };
  const syncDb = (): void => {
    const live = entities();
    migrate(db, live);
    bootstrap(db, live);
  };
  syncDb();
  return {
    addRecord: (entity, record) => insert(db, entityOf(entity), { ...record }),
    appDir,
    entitySlugs: () => entities().map((vow: ReadonlyVow) => vow.slug),
    getRecord: (entity, id) => get(db, entityOf(entity), id),
    getVow: (slug) => loadVows(appDir).find((vow: ReadonlyVow) => vow.slug === slug),
    listRecords: (entity) => list(db, entityOf(entity)),
    listVows: () => loadVows(appDir),
    removeRecord: (entity, id) => remove(db, entityOf(entity), id),
    syncDb,
    updateRecord: (patch) =>
      update(db, entityOf(patch.entity), patch.id, { [patch.field]: patch.value }),
    viewSlugs: () =>
      loadVows(appDir)
        .filter((vow: ReadonlyVow) => fulfilledAs(vow, "view"))
        .map((vow: ReadonlyVow) => vow.slug),
    ...structureSeam(appDir, syncDb),
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
