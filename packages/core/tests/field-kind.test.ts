import { FIELD_KINDS, FieldType } from "../src/index.ts";
import { expect, test } from "vite-plus/test";

/**
 * The field-type registry, pinned. `FIELD_KINDS` is a TOTAL `Record<FieldType, FieldKind>`, so a new
 * `FieldType` enum member is a COMPILE error until its descriptor is filled in — the seam that closes the
 * old silent "a new type degrades to text/undefined across 8 files" fall-through. These tests pin that the
 * registry covers exactly the enum AND that each descriptor matches the per-type facts the emitters emit.
 */

test("every FieldType enum member has a descriptor — and no stray keys", () => {
  const enumMembers = [...FieldType.options].toSorted();
  const registryKeys = Object.keys(FIELD_KINDS).toSorted();
  expect(registryKeys).toEqual(enumMembers);
});

test("the string-ish types are exactly text/longtext/date/reference", () => {
  const stringy = FieldType.options.filter((type) => FIELD_KINDS[type].isStringy).toSorted();
  expect(stringy).toEqual(["date", "longtext", "reference", "text"]);
});

test("the SQLite column affinity per type — REAL/INTEGER/TEXT", () => {
  expect(FIELD_KINDS.number.sqlColumn).toBe("REAL");
  expect(FIELD_KINDS.boolean.sqlColumn).toBe("INTEGER");
  for (const type of ["date", "longtext", "reference", "select", "text"] as const) {
    expect(FIELD_KINDS[type].sqlColumn, type).toBe("TEXT");
  }
});

test("the form-control kind per type", () => {
  expect(FIELD_KINDS.boolean.control).toBe("checkbox");
  expect(FIELD_KINDS.date.control).toBe("date");
  expect(FIELD_KINDS.longtext.control).toBe("textarea");
  expect(FIELD_KINDS.reference.control).toBe("select");
  expect(FIELD_KINDS.select.control).toBe("select");
  for (const type of ["number", "text"] as const) {
    expect(FIELD_KINDS[type].control, type).toBe("input");
  }
});

test("the list-cell kind per type", () => {
  expect(FIELD_KINDS.boolean.cell).toBe("yesno");
  expect(FIELD_KINDS.reference.cell).toBe("name");
  expect(FIELD_KINDS.select.cell).toBe("badge");
  for (const type of ["date", "longtext", "number", "text"] as const) {
    expect(FIELD_KINDS[type].cell, type).toBe("value");
  }
});

test("the zod base + default + sample expressions per type", () => {
  expect(FIELD_KINDS.number.zodBase).toBe("z.number()");
  expect(FIELD_KINDS.boolean.zodBase).toBe("z.boolean()");
  expect(FIELD_KINDS.number.defaultExpr).toBe("0");
  expect(FIELD_KINDS.boolean.defaultExpr).toBe("false");
  expect(FIELD_KINDS.number.sampleExpr).toBe("1");
  expect(FIELD_KINDS.date.sampleExpr).toBe('"2026-01-01"');
});
