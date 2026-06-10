/*
 * The vow primitive's public API — re-exported from focused concern modules: the `Vow` schema/types
 * (`vow`), the Markdown parser (`parse`), the folder-tree loader + reference check (`load`), the
 * serializer + writer (`serialize`), the typed authoring mutations (`mutate`), the scenario-coverage
 * gate (`coverage`), and the status roll-up (`rollup`). One recursive node, status never stored.
 */

export { uncoveredScenarios } from "./coverage.ts";
export { asRecord, defined, isRecord, mapDefined, type Maybe } from "./guard.ts";
export { SUFFIX, loadVow, loadVows, validateReferences } from "./load.ts";
export {
  addEntity,
  addField,
  addView,
  removeField,
  removeVow,
  setIntent,
  setNav,
} from "./mutate.ts";
export { parseVowMd } from "./parse.ts";
export type { DeepReadonly, ReadonlyField, ReadonlyVow } from "./readonly.ts";
export { deriveStatus } from "./rollup.ts";
export { serialize, writeVow } from "./serialize.ts";
export { Field, FieldType, FormSpec, Fulfillment, Scenario, Status, ViewNode, Vow } from "./vow.ts";
