import { pascalCase } from "@vow/component";
import type { Field, Vow } from "@vow/core";

/**
 * vow's entity emitter — the `emit entity` fulfilment made real.
 *
 *  - `emitEntityModule` → a typed module: a `<Name>` interface + a validating `create<Name>` factory.
 *  - `entityProves`     → the scenarios this entity proves, DERIVED from its fields (the contract).
 *  - `emitEntityTest`   → a Vitest suite whose test names ARE those proven scenarios.
 *
 * Field types: text → string, number → number, boolean → boolean, date → string (ISO-8601), select → a string-literal
 * union of its options, reference → string (the target entity's id). Files are written into `.generated/` — never source.
 */

const TS_TYPE: Record<"text" | "longtext" | "number" | "boolean" | "date", string> = {
  text: "string",
  longtext: "string", // multi-line text — a textarea in the UI, still a string
  number: "number",
  boolean: "boolean",
  date: "string", // ISO-8601 (YYYY-MM-DD) — string keeps it JSON- and adapter-neutral
};
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

/** The TS type for a field — a string-literal union for `select`, the target's id (string) for `reference`. */
function tsType(f: Field): string {
  if (f.type === "select") {
    return (f.options ?? []).map((o) => JSON.stringify(o)).join(" | ") || "string";
  }
  if (f.type === "reference") return "string"; // the referenced entity's id
  return TS_TYPE[f.type];
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

/** A typed module emitted from an `emit entity` vow: an interface + a validating factory. */
export function emitEntityModule(vow: Vow): string {
  ensureEntity(vow);
  const name = pascalCase(vow.slug);
  const required = vow.fields.filter((f) => f.required);
  const out: string[] = [
    `// Generated from vow "${vow.slug}". The vow tree is the source — do not edit.`,
    ``,
    `export interface ${name} {`,
    `  id: string; // a stable auto-id (referenced by reference fields); not a user field`,
  ];
  for (const f of vow.fields) out.push(`  ${f.name}: ${tsType(f)};`);
  out.push(`}`, ``, `export function create${name}(input: Partial<${name}>): ${name} {`);
  for (const f of required) {
    const stringy = f.type === "text" || f.type === "longtext" || f.type === "date";
    const empty = stringy ? ` || input.${f.name} === ""` : "";
    out.push(
      `  if (input.${f.name} === undefined${empty}) {`,
      `    throw new Error(${JSON.stringify(`${name}: '${f.name}' is required`)});`,
      `  }`,
    );
  }
  out.push(`  return {`);
  out.push(`    id: input.id ?? crypto.randomUUID(),`);
  for (const f of vow.fields) out.push(`    ${f.name}: input.${f.name} ?? ${defaultExpr(f)},`);
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
