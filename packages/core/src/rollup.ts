import type { Status, Vow } from "./vow.ts";

/**
 * Derive a vow's status — **never stored** (see vow.ts). A vow is `done` when everything it promises is
 * proven, `active` when some of it is, `planned` when none is yet; a parent rolls its children up
 * alongside its own proof. A claim is proven when `covered(claim)` — a matching, passing test exists
 * (the scenario-coverage signal, see coverage.ts). A leaf with no proof is `done`: it exists and
 * compiles, and the build is its proof.
 *
 * `blocked` needs CI (a failing test, not just a missing one) and arrives with the observability
 * adapter; today this returns `planned` · `active` · `done`.
 */
export function deriveStatus(vow: Vow, covered: (claim: string) => boolean): Status {
  const claims = vow.proof.map((p) => p.claim);
  const own: Status | null =
    claims.length === 0
      ? null // no promise of its own — its status is its children's (or `done` if it's a leaf)
      : claims.every(covered)
        ? "done"
        : claims.some(covered)
          ? "active"
          : "planned";

  const children = vow.children.map((child) => deriveStatus(child, covered));
  if (children.length === 0) return own ?? "done";

  const parts: Status[] = own === null ? children : [own, ...children];
  if (parts.every((s) => s === "done")) return "done";
  if (parts.some((s) => s !== "planned")) return "active";
  return "planned";
}
