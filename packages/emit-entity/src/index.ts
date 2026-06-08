import { pascalCase } from "@vow/component";
import type { Field, Vow } from "@vow/core";

/**
 * vow's entity emitter — the `emit entity` fulfilment made real.
 *
 *  - `emitEntityModule` → a typed module: a `<Name>Schema` (zod) + its inferred `<Name>` type + a
 *    validating `create<Name>` factory (`.parse`); a form re-uses the schema via `.safeParse`.
 *  - `entityProves`     → the scenarios this entity proves, DERIVED from its fields (the contract).
 *  - `emitEntityTest`   → a Vitest suite whose test names ARE those proven scenarios.
 *
 * Field types: text/longtext/date/reference → `z.string()`, number → `z.number()`, boolean → `z.boolean()`,
 * select → `z.enum([...])`. Files are written into `.generated/` — never source.
 */

const DEFAULT: Record<"text" | "longtext" | "number" | "boolean" | "date", string> = {
  text: '""',
  longtext: '""',
  number: "0",
  boolean: "false",
  date: '""',
};
const SAMPLE: Record<"text" | "longtext" | "number" | "boolean" | "date", string> = {
  text: '"x"',
  longtext: '"x"',
  number: "1",
  boolean: "true",
  date: '"2026-01-01"',
};

/**
 * The zod schema for a field — `z.enum` for select, `z.number`/`z.boolean` for those, else a string
 * (text/longtext/date/reference). A required string-ish field is `.min(1, "<name> is required")`, so an
 * empty submit is rejected with a per-field message the form can surface; the inferred TS type follows.
 */
function zodType(f: Field): string {
  let base: string;
  if (f.type === "select") {
    const opts = (f.options ?? []).map((o) => JSON.stringify(o)).join(", ");
    base = opts ? `z.enum([${opts}])` : "z.string()";
  } else if (f.type === "number") {
    base = "z.number()";
  } else if (f.type === "boolean") {
    base = "z.boolean()";
  } else {
    base = "z.string()"; // text · longtext · date · reference (the target's id)
  }
  const stringy =
    f.type === "text" || f.type === "longtext" || f.type === "date" || f.type === "reference";
  if (f.required && stringy) base = `z.string().min(1, ${JSON.stringify(`${f.name} is required`)})`;
  return base;
}
/** A default-value expression for the factory. */
function defaultExpr(f: Field): string {
  if (f.type === "select") return JSON.stringify(f.options?.[0] ?? "");
  if (f.type === "reference") return '""'; // no referent yet
  return DEFAULT[f.type];
}
/** A sample-value expression for the generated tests. */
function sampleExpr(f: Field): string {
  if (f.type === "select") return JSON.stringify(f.options?.[0] ?? "");
  if (f.type === "reference") return JSON.stringify(`${f.ref ?? "ref"}_1`); // a sample target id
  return SAMPLE[f.type];
}

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
    { claim: `A valid ${name} is built from its required fields` },
    ...required.map((f) => ({ claim: `${name} without '${f.name}' is rejected`, missing: f })),
  ];
}

/**
 * A typed module emitted from an `emit entity` vow: a **zod schema**, its inferred type, and a validating
 * `create<Name>` factory. The schema is the single source of validation — `create<Name>` runs `.parse`
 * (throwing on bad input), and a form runs `.safeParse` for per-field errors. An optional field is
 * defaulted before the parse; a required one is passed raw, so zod is what rejects it.
 */
export function emitEntityModule(vow: Vow): string {
  ensureEntity(vow);
  const name = pascalCase(vow.slug);
  const out: string[] = [
    `// Generated from vow "${vow.slug}". The vow tree is the source — do not edit.`,
    ``,
    `import { z } from "zod";`,
    ``,
    `export const ${name}Schema = z.object({`,
    `  id: z.string(), // a stable auto-id (referenced by reference fields); not a user field`,
  ];
  for (const f of vow.fields) out.push(`  ${f.name}: ${zodType(f)},`);
  out.push(`});`, ``);
  out.push(`export type ${name} = z.infer<typeof ${name}Schema>;`, ``);
  out.push(`export function create${name}(input: Partial<${name}>): ${name} {`);
  out.push(`  return ${name}Schema.parse({`);
  out.push(`    id: input.id ?? crypto.randomUUID(),`);
  for (const f of vow.fields) {
    const value = f.required ? `input.${f.name}` : `input.${f.name} ?? ${defaultExpr(f)}`;
    out.push(`    ${f.name}: ${value},`);
  }
  out.push(`  });`, `}`, ``);
  // `## seed` records → a typed seed array (each validated + auto-id'd via the factory); the boot loads it
  if (vow.seed !== undefined && vow.seed.length > 0) {
    out.push(`export const ${vow.slug}Seed: ${name}[] = [`);
    for (const record of vow.seed) out.push(`  create${name}(${JSON.stringify(record)}),`);
    out.push(`];`, ``);
  }
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
      .map((f) => `${f.name}: ${sampleExpr(f)}`)
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
      for (const f of required) out.push(`  expect(value.${f.name}).toBe(${sampleExpr(f)});`);
    }
    out.push(`});`);
  }
  out.push(``);
  return out.join("\n");
}
