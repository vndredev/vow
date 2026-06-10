/*
 * The vow primitive's BROWSER-SAFE public API — re-exported from focused concern modules: the `Vow`
 * schema/types (`vow`), the Markdown parser (`parse`), the `Maybe`/`defined` guards (`guard`), the
 * scenario-coverage gate (`coverage`), and the status roll-up (`rollup`). One recursive node, status
 * never stored. The filesystem-touching modules (loader, writer, mutations) live in `@vow/core/node` —
 * kept out of this barrel so a browser import of a pure helper never pulls `node:fs` into the bundle.
 */

export { uncoveredScenarios } from "./coverage.ts";
export { asRecord, defined, isRecord, mapDefined, type Maybe } from "./guard.ts";
export { parseVowMd } from "./parse.ts";
export type { DeepReadonly, ReadonlyField, ReadonlyVow } from "./readonly.ts";
export { deriveStatus } from "./rollup.ts";
export { Field, FieldType, FormSpec, Fulfillment, Scenario, Status, ViewNode, Vow } from "./vow.ts";
