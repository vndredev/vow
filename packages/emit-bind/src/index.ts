import type { Vow } from "@vow/core";

/**
 * vow's bind verifier — the `bind` fulfilment made safe.
 *
 * `bind` is the 10% escape hatch: instead of generating the logic, the vow.md points at a real,
 * hand-written export (`fulfills: bind ./logic.ts#fn`). vow doesn't generate the code — it VERIFIES
 * the seam. `emitBindAnchor` writes a tiny `.generated/<slug>.bind.ts` that re-exports the bound
 * symbol, so tsgo fails the gate if the declaration is a lie (the export is missing or renamed).
 * The behaviour itself is proven by the author's `## proves`, gated via scenario-coverage against a
 * hand-written test (vow can't derive the body of real logic).
 */

/** A type-anchor that re-exports the bound symbol so tsgo verifies it exists at the declared path. */
export function emitBindAnchor(vow: Vow, importSpecifier: string): string {
  if (vow.fulfills?.kind !== "bind") {
    throw new Error(`emit-bind: vow "${vow.slug}" has no \`bind\` fulfilment`);
  }
  const symbol = vow.fulfills.export;
  return [
    `// Generated anchor for vow "${vow.slug}". Re-exports the bound symbol so tsgo verifies it`,
    `// exists at the declared path. The vow.md is the source — do not edit.`,
    `export { ${symbol} } from ${JSON.stringify(importSpecifier)};`,
    ``,
  ].join("\n");
}
