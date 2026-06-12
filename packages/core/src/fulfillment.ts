import type { ReadonlyVow } from "./readonly.ts";

/**
 * The canonical "how is this vow emitted?" predicate — the single home for
 * `vow.fulfills?.kind === "emit" && vow.fulfills.as === <target>`. Every consumer (the loader, the
 * gate, the view/entity emitters, the plugin, the MCP) used to re-inline this body — twice under
 * different names — so the one truth lives here, beside the `Fulfillment` union it reads.
 *
 * The parameter is the read-only vow view (a plain `Vow` widens to it): only `fulfills` is read.
 */

/** The `emit` targets a vow may be fulfilled as — the three the emitters render. */
export type EmitTarget = "entity" | "form" | "view";

/** Whether a vow is fulfilled as `emit <target>` (e.g. `isEmit(vow, "view")`). */
export function isEmit(vow: ReadonlyVow, as: EmitTarget): boolean {
  return vow.fulfills?.kind === "emit" && vow.fulfills.as === as;
}

/** Whether a vow is fulfilled as an `emit entity` — the convenience the view emitters render over. */
export function isEmitEntity(vow: ReadonlyVow): boolean {
  return isEmit(vow, "entity");
}
