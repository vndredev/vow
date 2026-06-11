import type { ModelPolicy, Role } from "./types.ts";

/**
 * The model axis — orthogonal to the provider (the provider says WHICH CLI, the model says WHICH BRAIN). A
 * `ModelPolicy` maps a role to its model; the loop resolves role → model → the task → the provider's own
 * model flag. The capable model plans + audits; a cheaper one executes the gated, drift-proof plan.
 */

/** The model a `role` resolves to under `policy` — the loop's role → model step. `""` means no override
 *  (the provider's own default brain). Pure. */
export function modelFor(policy: Readonly<ModelPolicy>, role: Role): string {
  return policy[role];
}
