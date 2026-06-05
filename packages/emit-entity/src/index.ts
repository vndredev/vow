import type { Field, Vow } from "@vow/core";

/**
 * vow's entity emitter — the `emit entity` fulfilment made real.
 *
 *  - `emitEntityModule` → a typed module: a `<Name>` interface + a validating `create<Name>` factory.
 *  - `entityProves`     → the scenarios this entity proves, DERIVED from its fields (the contract).
 *  - `emitEntityTest`   → a Vitest suite whose test names ARE those proven scenarios. No one writes
 *    these — for `emit`, the proof (claim + body) falls out of the declaration.
 *
 * Both files are written into `.generated/` by the Vite plugin, compiled/run by Vite+ — never source.
 */

const TS_TYPE: Record<Field["type"], string> = {
  text: "string",
  number: "number",
  boolean: "boolean",
};
const DEFAULT: Record<Field["type"], string> = { text: '""', number: "0", boolean: "false" };
const SAMPLE: Record<Field["type"], string> = { text: '"x"', number: "1", boolean: "true" };

/** kebab-case slug → PascalCase type name (`task` → `Task`, `audit-log` → `AuditLog`). */
const pascalCase = (slug: string): string =>
  slug
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("");

function ensureEntity(vow: Vow): void {
  if (vow.fulfills?.kind !== "emit" || vow.fulfills.as !== "entity") {
    throw new Error(`emit-entity: vow "${vow.slug}" is not an \`emit entity\``);
  }
}

/** The scenarios an `emit entity` vow proves, derived from its fields — these ARE the test names. */
function entityScenarios(vow: Vow): { claim: string; missing?: Field }[] {
  const name = pascalCase(vow.slug);
  const required = vow.fields.filter((f) => f.required);
  return [
    { claim: `Eine gültige ${name} entsteht aus ihren Pflichtfeldern` },
    ...required.map((f) => ({ claim: `Eine ${name} ohne '${f.name}' wird abgelehnt`, missing: f })),
  ];
}

/** A typed module emitted from an `emit entity` vow: an interface + a validating factory. */
export function emitEntityModule(vow: Vow): string {
  ensureEntity(vow);
  const name = pascalCase(vow.slug);
  const required = vow.fields.filter((f) => f.required);
  const out: string[] = [
    `// Generated from vow "${vow.slug}". The vow tree is the source — do not edit.`,
    ``,
    `export interface ${name} {`,
  ];
  for (const f of vow.fields) out.push(`  ${f.name}: ${TS_TYPE[f.type]};`);
  out.push(`}`, ``, `export function create${name}(input: Partial<${name}>): ${name} {`);
  for (const f of required) {
    const empty = f.type === "text" ? ` || input.${f.name} === ""` : "";
    out.push(
      `  if (input.${f.name} === undefined${empty}) {`,
      `    throw new Error(${JSON.stringify(`${name}: '${f.name}' is required`)});`,
      `  }`,
    );
  }
  out.push(`  return {`);
  for (const f of vow.fields) out.push(`    ${f.name}: input.${f.name} ?? ${DEFAULT[f.type]},`);
  out.push(`  };`, `}`, ``);
  return out.join("\n");
}

/** The proven scenarios (claims) of an `emit entity` vow — what the scenario-coverage gate checks. */
export function entityProves(vow: Vow): string[] {
  ensureEntity(vow);
  return entityScenarios(vow).map((s) => s.claim);
}

/** A Vitest suite whose test names ARE the proven scenarios; bodies derived from the fields. */
export function emitEntityTest(vow: Vow): string {
  ensureEntity(vow);
  const name = pascalCase(vow.slug);
  const required = vow.fields.filter((f) => f.required);
  const validEntries = (exclude?: string): string =>
    required
      .filter((f) => f.name !== exclude)
      .map((f) => `${f.name}: ${SAMPLE[f.type]}`)
      .join(", ");

  const out: string[] = [
    `import { expect, test } from "vite-plus/test";`,
    `import { create${name} } from "./${vow.slug}.ts";`,
    ``,
    `// Generated from vow "${vow.slug}". Each test name IS a proven scenario — do not edit.`,
  ];
  for (const s of entityScenarios(vow)) {
    out.push(``, `test(${JSON.stringify(s.claim)}, () => {`);
    if (s.missing) {
      out.push(`  expect(() => create${name}({ ${validEntries(s.missing.name)} })).toThrow();`);
    } else {
      out.push(`  const value = create${name}({ ${validEntries()} });`);
      for (const f of required) out.push(`  expect(value.${f.name}).toBe(${SAMPLE[f.type]});`);
    }
    out.push(`});`);
  }
  out.push(``);
  return out.join("\n");
}
