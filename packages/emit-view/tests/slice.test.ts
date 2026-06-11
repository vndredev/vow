import { expect, test } from "vite-plus/test";
import { sliceAttrs, sliceComputed } from "../src/slice.ts";

test("sliceComputed emits a type-aware sort — numeric subtraction for numbers, localeCompare for text", () => {
  const setup = sliceComputed("Task", "rows").join("\n");
  expect(setup).toContain('typeof x === "number"');
  expect(setup).toContain("x - y");
  expect(setup).toContain("localeCompare");
  // No longer the always-stringify comparator (which sorted 2/10/100 lexically as "10","100","2").
  expect(setup).not.toContain("String(a[s]).localeCompare(String(b[s]))");
});

test("sliceAttrs coerces a `filter` through core's asRecord — an object passes through, a non-object empties", () => {
  const [withObject] = sliceAttrs({ filter: { status: "open" } });
  expect(withObject).toEqual({ expr: "{ status: 'open' }", kind: "bound", name: "filter" });

  // A non-object filter coerces to an empty object literal (the asRecord fallback), never a crash.
  const [withScalar] = sliceAttrs({ filter: "open" });
  expect(withScalar).toEqual({ expr: "{  }", kind: "bound", name: "filter" });
});
