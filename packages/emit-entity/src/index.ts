import { ensureEntity, entityScenarios } from "./scenarios.ts";
import type { ReadonlyVow } from "./types.ts";

/**
 * Vow's entity emitter — the `emit entity` fulfilment made real, re-exported from focused concerns:
 *
 *  - `emitEntityModule` (./module.ts)      -> a typed module: a `<Name>Schema` (zod) + its inferred
 *    `<Name>` type + a validating `create<Name>` factory (`.parse`); a form re-uses it via `.safeParse`.
 *  - `entityProves`     (here)             -> the scenarios this entity proves, DERIVED from its fields.
 *  - `emitEntityTest`   (./entity-test.ts) -> a Vitest suite whose test names ARE those proven scenarios.
 *
 * Field types: text/longtext/date/reference -> `z.string()`, number -> `z.number()`, boolean ->
 * `z.boolean()`, select -> `z.enum([...])`. Files are written into `.generated/` — never source.
 */

export { emitEntityTest } from "./entity-test.ts";
export { emitEntityModule } from "./module.ts";

/** The proven scenarios (claims) of an `emit entity` vow — what the scenario-coverage gate checks. */
export function entityProves(vow: ReadonlyVow): string[] {
  ensureEntity(vow);
  return entityScenarios(vow).map((scenario) => scenario.claim);
}
