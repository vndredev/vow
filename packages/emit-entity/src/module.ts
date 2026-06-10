import type { ReadonlyField, ReadonlyVow } from "@vow/core";
import { defaultExpr, zodType } from "./field-expr.ts";
import { defined } from "./guard.ts";
import { ensureEntity } from "./scenarios.ts";
import { pascalCase } from "@vow/component";

/**
 * The `emit entity` module emitter — a typed module with a **zod schema**, its inferred type, and a
 * validating `create<Name>` factory. The schema is the single source of validation: `create<Name>`
 * runs `.parse` (throwing on bad input), and a form runs `.safeParse` for per-field errors. An optional
 * field is defaulted before the parse; a required one is passed raw, so zod is what rejects it.
 */

/** The zod object body — one line per field (the auto-id is emitted before this). */
function schemaBody(fields: readonly ReadonlyField[]): readonly string[] {
  return fields.map((field) => `  ${field.name}: ${zodType(field)},`);
}

/** The `create<Name>` factory body — the auto-id, then each field defaulted or passed raw. */
function factoryBody(fields: readonly ReadonlyField[]): readonly string[] {
  const lines: string[] = [`    id: input.id ?? crypto.randomUUID(),`];
  for (const field of fields) {
    if (field.required) {
      lines.push(`    ${field.name}: input.${field.name},`);
    } else {
      lines.push(`    ${field.name}: input.${field.name} ?? ${defaultExpr(field)},`);
    }
  }
  return lines;
}

/** The optional typed seed array — each `## seed` record validated + auto-id'd via the factory. */
function seedBlock(vow: ReadonlyVow, name: string): readonly string[] {
  if (!defined(vow.seed) || vow.seed.length === 0) {
    return [];
  }
  const lines: string[] = [`export const ${vow.slug}Seed: ${name}[] = [`];
  for (const record of vow.seed) {
    lines.push(`  create${name}(${JSON.stringify(record)}),`);
  }
  lines.push(`];`, ``);
  return lines;
}

/**
 * A typed module emitted from an `emit entity` vow: a zod schema, its inferred type, and a validating
 * `create<Name>` factory. Files are written into `.generated/` — never source.
 */
export function emitEntityModule(vow: ReadonlyVow): string {
  ensureEntity(vow);
  const name = pascalCase(vow.slug);
  const out: string[] = [
    `// Generated from vow "${vow.slug}". The vow tree is the source — do not edit.`,
    ``,
    `import { z } from "zod";`,
    ``,
    `export const ${name}Schema = z.object({`,
    `  id: z.string(), // a stable auto-id (referenced by reference fields); not a user field`,
    ...schemaBody(vow.fields),
    `});`,
    ``,
    `export type ${name} = z.infer<typeof ${name}Schema>;`,
    ``,
    `export function create${name}(input: Partial<${name}>): ${name} {`,
    `  return ${name}Schema.parse({`,
    ...factoryBody(vow.fields),
    `  });`,
    `}`,
    ``,
    ...seedBlock(vow, name),
  ];
  return out.join("\n");
}
