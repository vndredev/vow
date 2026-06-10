// oxlint-disable-next-line consistent-type-specifier-style -- one import; separate trips no-duplicate-imports
import { type Db, bootstrap, migrate, openDb, resolveDbPath } from "@vow/db";
import type { ReadonlyVow } from "@vow/core";
import { entityVows } from "./vows.ts";
import { mutable } from "./mutable.ts";

export type { Db } from "@vow/db";

/**
 * The dev DB seam — opening the local SQLite store and keeping its schema + seed in sync with the entity
 * vows. `@vow/db` declares mutable `Vow` parameters, so the entity vows are widened through the `mutable`
 * seam here (the db layer only reads them). The studio reads this DB and the MCP shares it.
 */

/** Open the local SQLite DB for the project rooted at `root`. */
export function openDevDb(root: string): Db {
  return openDb(resolveDbPath(root));
}

/** Migrate + seed the DB to the entity tables derived from the tree; returns the derived entity vows. */
// oxlint-disable-next-line prefer-readonly-parameter-types -- @vow/db mutates the DB handle it is given
export function syncEntities(db: Db, vows: readonly ReadonlyVow[]): readonly ReadonlyVow[] {
  const entities = entityVows(vows);
  const mutableEntities = entities.map((entity) => mutable(entity));
  migrate(db, mutableEntities);
  bootstrap(db, mutableEntities);
  return entities;
}
