import type { FieldType } from "./vow.ts";

/**
 * The field-type descriptor table — the ONE capability registry every `field.type` branch reads from, the
 * emit-side twin of `theme/src/vocab.ts`. Each `FieldType` maps to a `FieldKind` of purely type-driven
 * facts: the base zod type, the SQLite column, the factory default + test sample, the form-control shape,
 * the list-cell shape, and whether the value is string-ish. Branches that ALSO need a field's data (a
 * `select`'s options, a `reference`'s target) special-case those in the emitter, then fall back here.
 *
 * Typed as a TOTAL `Record<FieldType, FieldKind>`: adding a `FieldType` member is a compile error until its
 * descriptor is filled in — the seam that closes the silent "new type degrades to text/undefined"
 * fall-through. Dependency-free (only the `FieldType` union), so it stays browser-safe in `@vow/core`.
 */

/** How a form renders a field's input control (`@vow/emit-view`'s `fieldControl`). `select` covers vow's
 *  Select primitive over a fixed list AND over a reference's target collection. */
export type FieldControl = "checkbox" | "date" | "input" | "select" | "textarea";

/** How a list renders a field's cell (`@vow/emit-view`'s `cellContent`). `badge` is the select status chip,
 *  `name` the resolved referent display, `yesno` the boolean Yes/No, `value` the raw interpolation. */
export type FieldCell = "badge" | "name" | "value" | "yesno";

/** A SQLite column affinity — REAL for number, INTEGER for a 0/1 boolean, else TEXT. */
export type SqlColumn = "INTEGER" | "REAL" | "TEXT";

/** The purely type-driven facts about a field type — the value behind every `field.type` branch. */
export interface FieldKind {
  /** The list-cell rendering mode (`cellContent`). */
  readonly cell: FieldCell;
  /** The form-control rendering mode (`fieldControl`). */
  readonly control: FieldControl;
  /** The factory/db default-value expression, as TS source (`""`, `0`, `false`, `'"..."'`). */
  readonly defaultExpr: string;
  /** Whether the value is string-ish — text/longtext/date/reference all store + validate as strings. */
  readonly isStringy: boolean;
  /** The test-sample expression, as TS source (e.g. `"1"`, `'"2026-01-01"'`). */
  readonly sampleExpr: string;
  /** The SQLite column affinity. */
  readonly sqlColumn: SqlColumn;
  /** The base zod expression (before the required-string refinement); select overrides with `z.enum`. */
  readonly zodBase: string;
}

/**
 * The descriptor per field type. The five string-ish types (text/longtext/date/reference) share a zod
 * string, a TEXT column, and an empty-string default; number/boolean/select carry their own. `select` and
 * `reference` keep their listed `defaultExpr`/`sampleExpr` as the FALLBACK the emitter overrides with the
 * field's own options/target — so the table stays total while the data-driven cases special-case.
 */
export const FIELD_KINDS: Record<FieldType, FieldKind> = {
  boolean: {
    cell: "yesno",
    control: "checkbox",
    defaultExpr: "false",
    isStringy: false,
    sampleExpr: "true",
    sqlColumn: "INTEGER",
    zodBase: "z.boolean()",
  },
  date: {
    cell: "value",
    control: "date",
    defaultExpr: '""',
    isStringy: true,
    sampleExpr: '"2026-01-01"',
    sqlColumn: "TEXT",
    zodBase: "z.string()",
  },
  longtext: {
    cell: "value",
    control: "textarea",
    defaultExpr: '""',
    isStringy: true,
    sampleExpr: '"x"',
    sqlColumn: "TEXT",
    zodBase: "z.string()",
  },
  number: {
    cell: "value",
    control: "input",
    defaultExpr: "0",
    isStringy: false,
    sampleExpr: "1",
    sqlColumn: "REAL",
    zodBase: "z.number()",
  },
  reference: {
    cell: "name",
    control: "select",
    defaultExpr: '""',
    isStringy: true,
    sampleExpr: '""',
    sqlColumn: "TEXT",
    zodBase: "z.string()",
  },
  select: {
    cell: "badge",
    control: "select",
    defaultExpr: '""',
    isStringy: false,
    sampleExpr: '""',
    sqlColumn: "TEXT",
    zodBase: "z.string()",
  },
  text: {
    cell: "value",
    control: "input",
    defaultExpr: '""',
    isStringy: true,
    sampleExpr: '"x"',
    sqlColumn: "TEXT",
    zodBase: "z.string()",
  },
};
