import type { UiNode } from "./types.ts";
import { txt } from "./helpers.ts";

/**
 * The loading / failed / empty status-message trio every store-backed view shares — the list, cards,
 * board and stats over an entity, and the three live issue layouts. One source, so a view never lies
 * about a fetch: a cold load reads "Loading…", a failed fetch reads its error copy (never as zero
 * records), and the friendly empty copy shows only once the fetch has settled on a genuinely empty set.
 */

/** A `.vow-empty` status message shown in place of the content, guarded by `cond` (a `v-if`) so only the
 *  one matching state renders. The three are mutually exclusive (no `v-else` in the component model). */
export function statusMessage(cond: string, message: string): UiNode {
  return {
    attrs: [
      { kind: "static", name: "class", value: "vow-empty" },
      { expr: cond, kind: "cond", type: "if" },
    ],
    children: [txt(message)],
    kind: "element",
    tag: "p",
  };
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
    statusMessage(`state.error && ${empty}`, copy.failed),
    statusMessage(`!state.loading && !state.error && ${empty}`, copy.empty),
  ];
}
