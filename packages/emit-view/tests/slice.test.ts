import { expect, test } from "vite-plus/test";
import { sliceComputed } from "../src/slice.ts";

test("sliceComputed emits a type-aware sort — numeric subtraction for numbers, localeCompare for text", () => {
  const setup = sliceComputed("Task", "rows").join("\n");
  expect(setup).toContain('typeof x === "number"');
  expect(setup).toContain("x - y");
  expect(setup).toContain("localeCompare");
  // No longer the always-stringify comparator (which sorted 2/10/100 lexically as "10","100","2").
  expect(setup).not.toContain("String(a[s]).localeCompare(String(b[s]))");
});
