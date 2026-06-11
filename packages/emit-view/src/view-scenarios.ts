import type { ReadonlyVow } from "./types.ts";
import { pascalCase } from "@vow/component";

/**
 * The render + a11y scenarios every generated `.vue` proves — these ARE the generated test names, so the
 * scenario-coverage gate covers them. Derived, not authored: the generated UI proves itself, the way an
 * entity's factory tests do. The label is the PascalCase component name, shared with the view emitters
 * (`naming.ts`), so the name the gate derives and the name the test writes can never drift.
 */

/** One render scenario: its claim (the test name) and which check the generated body performs. */
export interface RenderScenario {
  readonly claim: string;
  readonly kind: "a11y" | "render" | "submit";
}

/** The two scenarios every generated component proves: it renders, and it has no a11y violations. */
export function renderScenarios(label: string): readonly RenderScenario[] {
  return [
    { claim: `The ${label} view renders`, kind: "render" },
    { claim: `The ${label} view has no accessibility violations`, kind: "a11y" },
  ];
}

/** The render-scenario claims a vow proves for its generated component (`task` → the `Task.vue` claims). */
export function viewProves(vow: ReadonlyVow): readonly string[] {
  return renderScenarios(pascalCase(vow.slug)).map((scenario) => scenario.claim);
}

/** The scenario a generated form proves: an incomplete submit is rejected — but ONLY when the form's
 *  entity has a required field. An all-optional entity validates an empty submit cleanly (no ZodError, no
 *  `[role=alert]`), so there is nothing to assert and no scenario/test is emitted. */
export function formScenarios(label: string, hasRequired: boolean): readonly RenderScenario[] {
  if (!hasRequired) {
    return [];
  }
  return [{ claim: `The ${label} form rejects an incomplete submit`, kind: "submit" }];
}

/** The form-interaction claims a vow proves for its generated form (`add-task` → the `AddTask` claim). */
export function formProves(vow: ReadonlyVow, hasRequired: boolean): readonly string[] {
  return formScenarios(pascalCase(vow.slug), hasRequired).map((scenario) => scenario.claim);
}
