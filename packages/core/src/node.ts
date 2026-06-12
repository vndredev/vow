/*
 * The NODE-SIDE entry — the full vow API INCLUDING the filesystem-touching modules (the folder-tree
 * loader + reference check, the serializer + writer, the typed authoring mutations). Node consumers
 * (the vite plugin, the gate, the MCP) import everything from here; the browser-safe `@vow/core` barrel
 * deliberately omits these `node:fs` modules so a client import of a pure helper never pulls `node:fs`
 * into the bundle.
 */

export { uncoveredScenarios } from "./coverage.ts";
export { type EmitTarget, isEmit, isEmitEntity } from "./fulfillment.ts";
export { asRecord, defined, isRecord, mapDefined, type Maybe } from "./guard.ts";
export { SUFFIX, loadVow, loadVows, validateIcons, validateReferences } from "./load.ts";
export {
  addEntity,
  addField,
  addForm,
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
