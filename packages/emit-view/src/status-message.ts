import type { UiNode } from "./types.ts";
import { txt } from "./helpers.ts";

/**
 * The loading / failed / empty status-message trio every store-backed view shares — the list, cards,
 * board and stats over an entity, and the three live issue layouts. One source, so a view never lies
 * about a fetch: a cold load reads "Loading…", a failed fetch reads its error copy (never as zero
 * records), and the friendly empty copy shows only once the fetch has settled on a genuinely empty set.
 */

/** The live-region semantics a status node carries — a `role` and an `aria-live` urgency, both static
 *  (the adapter writes them verbatim, no framework primitive). Polite for steady states, assertive for an error. */
interface LiveRegion {
  readonly live: string;
  readonly role: string;
}

/** A `.vow-empty` status node, guarded by `cond` (a `v-if`) so only the matching state renders, carrying
 *  the `region` live-region semantics so a screen reader announces the swap when the fetch settles
 *  (WCAG 4.1.3). `role`/`aria-live` are static — the adapter writes them verbatim, no framework primitive. */
function liveStatus(cond: string, message: string, region: LiveRegion): UiNode {
  return {
    attrs: [
      { kind: "static", name: "class", value: "vow-empty" },
      { kind: "static", name: "role", value: region.role },
      { kind: "static", name: "aria-live", value: region.live },
      { expr: cond, kind: "cond", type: "if" },
    ],
    children: [txt(message)],
    kind: "element",
    tag: "p",
  };
}

/** A polite `.vow-empty` status message (loading / genuinely-empty) shown in place of the content, guarded
 *  by `cond` (a `v-if`) so only the one matching state renders. Carries `role="status"` + `aria-live="polite"`
 *  so the swap is announced without interrupting the user. The three are mutually exclusive (no `v-else`). */
export function statusMessage(cond: string, message: string): UiNode {
  return liveStatus(cond, message, { live: "polite", role: "status" });
}

/** An assertive `.vow-empty` error message (a failed fetch) shown in place of the content, guarded by `cond`
 *  (a `v-if`). Carries `role="alert"` + `aria-live="assertive"` so the failure is announced at once (WCAG
 *  4.1.3) — a screen-reader user is told the load errored rather than left on a silently-empty view. */
export function errorMessage(cond: string, message: string): UiNode {
  return liveStatus(cond, message, { live: "assertive", role: "alert" });
}

/** The three messages a status trio carries — loading (the first fetch in flight), failed (the fetch
 *  errored), and empty (the fetch succeeded on a genuinely empty collection). */
export interface StatusCopy {
  readonly empty: string;
  readonly failed: string;
  readonly loading: string;
}

/**
 * The three mutually-exclusive status messages over an empty collection, keyed off a reactive `state`
 * and the `count` of currently-held rows (`rows.length` for an entity view, `items.length` for an issue
 * layout). Loading is exclusive — `state.loading && !state.error && <count> === 0` — so a quiet retry on
 * an already-failed collection keeps showing the steady error copy instead of stacking "Loading…" on top
 * of it. Failed shows whenever the fetch errored on an empty set; empty only once it settled clean.
 */
export function emptyStates(count: string, copy: StatusCopy): readonly UiNode[] {
  const empty = `${count} === 0`;
  return [
    statusMessage(`state.loading && !state.error && ${empty}`, copy.loading),
    errorMessage(`state.error && ${empty}`, copy.failed),
    statusMessage(`!state.loading && !state.error && ${empty}`, copy.empty),
  ];
}
