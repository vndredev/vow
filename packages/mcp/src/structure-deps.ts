import type {
  Db,
  DepsContext,
  FieldPatch,
  Maybe,
  ReadonlyField,
  ReadonlyVow,
  SqlColumn,
  StructureDeps,
} from "./types.ts";
import {
  archiveTable,
  assertColumnAbsent,
  assertColumnFree,
  assertTableFree,
  assertValuesCovered,
  columnType,
  convertColumn,
  renameColumn,
  seedEntity,
} from "@vow/db";
import { defined, isEmit, loadVows } from "@vow/core/node";

/**
 * The structure-mutation seams the studio binds to — each a `@vow/db` guard or migration, wired to the
 * right moment relative to the vow `.md` rewrite so the vow and the live DB never diverge (the field /
 * entity / seed data-evolution guards). Held in their own module so `studio.ts` stays a lean wiring step.
 * The seam set (`StructureDeps`) + its build context (`DepsContext`) live in the `types.ts` hub.
 */

/** A field of `entity` by name — absent when none (a `set_field` on an unknown field; `setField` itself
 *  throws the actionable error, so the guards just no-op). */
function fieldByName(entity: ReadonlyVow, name: string): Maybe<ReadonlyField> {
  return entity.fields.find((candidate: ReadonlyField) => candidate.name === name);
}

/** The field's type after a patch — the patch's new type, else the current type (a no-retype patch). */
function patchedType(field: ReadonlyField, patch: FieldPatch): ReadonlyField["type"] {
  return patch.type ?? field.type;
}

/** The field's `select` options after a patch — the patch's new set, else the current (empty when none). */
function patchedOptions(field: ReadonlyField, patch: FieldPatch): readonly string[] {
  return patch.options ?? field.options ?? [];
}

/** The SQLite column type a `FieldType` maps to — a stub field carries only the `type` the mapping reads. */
function sqlColumnOf(type: ReadonlyField["type"]): SqlColumn {
  return columnType({ name: "", required: false, type });
}

/** Whether the patched field is a `select` carrying options — the trigger for the values-covered guard
 *  (true on a retype TO select, false on a retype AWAY from select, which drops the options). */
function landsSelect(field: ReadonlyField, patch: FieldPatch): boolean {
  return patchedType(field, patch) === "select" && patchedOptions(field, patch).length > 0;
}

/** Archive an emit entity's table on drop (rename to `_dropped_<slug>`), so a re-created slug starts
 *  fresh and the dead rows stay recoverable. A no-op for a non-entity vow (no table to archive). */
function archiveDropped(appDir: string, db: Db, slug: string): void {
  const dropped = loadVows(appDir).find((vow: ReadonlyVow) => vow.slug === slug);
  if (defined(dropped) && isEmit(dropped, "entity")) {
    archiveTable(db, slug);
  }
}

/** Reject a `select`-options shrink that strands a stored value — only when the patched field still lands
 *  a `select` with options (so a retype AWAY from select passes; the column becomes free text). Run on
 *  the OLD column name, BEFORE the rewrite. A no-op when the field is unknown. */
// eslint-disable-next-line max-params
function guardOptions(db: Db, entity: ReadonlyVow, field: string, patch: FieldPatch): void {
  const current = fieldByName(entity, field);
  if (defined(current) && landsSelect(current, patch)) {
    assertValuesCovered(db, entity.slug, field, patchedOptions(current, patch));
  }
}

/** Rebuild a field's column when the retype changed its stored type — run AFTER the rename, so `field`
 *  is the final column name and `was` is the pre-patch column type. A no-op when the type is unchanged. */
// eslint-disable-next-line max-params
function convertType(db: Db, slug: string, field: string, patch: FieldPatch, was: SqlColumn): void {
  if (defined(patch.type) && sqlColumnOf(patch.type) !== was) {
    convertColumn(db, slug, field, sqlColumnOf(patch.type));
  }
}

/** The pre-patch column type of a field, or absence when the field is unknown — captured by the studio
 *  BEFORE a `set_field` rewrite so the retype rebuild can decide from the type the patch moved away from. */
function columnTypeOf(entity: ReadonlyVow, field: string): Maybe<SqlColumn> {
  const current = fieldByName(entity, field);
  if (defined(current)) {
    return sqlColumnOf(current.type);
  }
  return current;
}

/** Build the structure-mutation deps over the shared DB + the app dir + the entity resolver. Each seam
 *  resolves the live entity (so the table name follows the slug) and runs one `@vow/db` guard / migration. */
export function structureDeps(context: DepsContext): StructureDeps {
  const { appDir, db, entityOf, syncDb } = context;
  return {
    archiveDropped: (slug) => {
      archiveDropped(appDir, db, slug);
    },
    columnTypeOf: (entity, field) => columnTypeOf(entityOf(entity), field),
    // eslint-disable-next-line max-params
    convertType: (entity, field, patch, was) => {
      convertType(db, entityOf(entity).slug, field, patch, was);
    },
    guardAddField: (entity, field) => {
      assertColumnAbsent(db, entityOf(entity).slug, field.name);
    },
    guardCreateEntity: (slug) => {
      assertTableFree(db, slug);
    },
    guardOptions: (entity, field, patch) => {
      guardOptions(db, entityOf(entity), field, patch);
    },
    guardRename: (entity, from, to) => {
      assertColumnFree(db, entityOf(entity).slug, from, to);
    },
    renameField: (entity, from, to) => {
      renameColumn(db, entityOf(entity).slug, from, to);
    },
    seedFresh: (entity) => {
      const vow = entityOf(entity);
      return seedEntity(db, vow, vow.seed ?? []);
    },
    syncDb,
  };
}
