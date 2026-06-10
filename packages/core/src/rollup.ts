import type { ReadonlyVow } from "./readonly.ts";
import type { Status } from "./vow.ts";

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

/** Roll a set of part-statuses into one: all `done` → `done`, any progress → `active`, else `planned`. */
function combine(parts: readonly Status[]): Status {
  if (parts.every((status) => status === "done")) {
    return "done";
  }
  if (parts.some((status) => status !== "planned")) {
    return "active";
  }
  return "planned";
}

/** One claim's part-status: `done` when covered, `planned` when not. */
function claimStatus(covered: boolean): Status {
  if (covered) {
    return "done";
  }
  return "planned";
}

export function deriveStatus(vow: ReadonlyVow, covered: (claim: string) => boolean): Status {
  const parts: Status[] = [];
  // A vow's OWN proof contributes one rolled-up part — only when it makes a claim of its own.
  if (vow.proof.length > 0) {
    parts.push(combine(vow.proof.map((scenario) => claimStatus(covered(scenario.claim)))));
  }
  for (const child of vow.children) {
    parts.push(deriveStatus(child, covered));
  }

  // A leaf that makes no promise of its own is `done` — it exists and compiles.
  if (parts.length === 0) {
    return "done";
  }
  return combine(parts);
}
