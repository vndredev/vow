import type { ReadonlyField, ReadonlyVow } from "./types.ts";
import { ensureEntity, entityScenarios } from "./scenarios.ts";
import { defined } from "@vow/core";
import { pascalCase } from "@vow/component";
import { sampleExpr } from "./field-expr.ts";

/** One proven scenario, as `entityScenarios` yields it — the element type of its return. */
type EntityScenario = ReturnType<typeof entityScenarios>[number];

/**
 * The `emit entity` test emitter — a Vitest suite whose test names ARE the proven scenarios, with each
 * body derived from the entity's required fields (a build-and-assert for the valid case, a `.toThrow`
 * for each omitted-required-field rejection).
 */

/** The shared inputs every generated test needs — the entity name and its required fields. */
interface TestContext {
  readonly name: string;
  readonly required: readonly ReadonlyField[];
}

/** The valid sample-field entries for a `create<Name>` call, optionally omitting one field. */
function validEntries(ctx: TestContext, exclude: ReadonlyField | undefined): string {
  return ctx.required
    .filter((field) => !defined(exclude) || field.name !== exclude.name)
    .map((field) => `${field.name}: ${sampleExpr(field)}`)
    .join(", ");
}

/** The body of a single generated test — a rejection check, or a build-and-assert. */
function testBody(ctx: TestContext, missing: ReadonlyField | undefined): readonly string[] {
  if (defined(missing)) {
    return [`  expect(() => create${ctx.name}({ ${validEntries(ctx, missing)} })).toThrow();`];
  }
  const lines: string[] = [`  const value = create${ctx.name}({ ${validEntries(ctx, missing)} });`];
  for (const field of ctx.required) {
    lines.push(`  expect(value.${field.name}).toBe(${sampleExpr(field)});`);
  }
  return lines;
}

/** One generated `test(...)` block — its name is the scenario, its body derived from the fields. */
function testBlock(ctx: TestContext, scenario: EntityScenario): readonly string[] {
  return [
    ``,
    `test(${JSON.stringify(scenario.claim)}, () => {`,
    ...testBody(ctx, scenario.missing),
    `});`,
  ];
}

/** A Vitest suite whose test names ARE the proven scenarios; bodies derived from the fields. */
export function emitEntityTest(vow: ReadonlyVow): string {
  ensureEntity(vow);
  const ctx: TestContext = {
    name: pascalCase(vow.slug),
    required: vow.fields.filter((field) => field.required),
  };
  const out: string[] = [
    `import { expect, test } from "vite-plus/test";`,
    `import { create${ctx.name} } from "./${vow.slug}.ts";`,
    ``,
    `// Generated from vow "${vow.slug}". Each test name IS a proven scenario — do not edit.`,
  ];
  for (const scenario of entityScenarios(vow)) {
    out.push(...testBlock(ctx, scenario));
  }
  out.push(``);
  return out.join("\n");
}
