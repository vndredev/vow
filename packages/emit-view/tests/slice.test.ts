import { expect, test } from "vite-plus/test";
import { sliceAttrs, sliceComputed } from "../src/slice.ts";
import { quote } from "../src/helpers.ts";

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

test("quote escapes a backslash + newline + quotes into a compilable, faithful single-quoted literal", () => {
  // The exact inputs that broke before. A lone backslash silently became a control char.
  // A newline aborted `vp build` by splitting the line into an unterminated string.
  const literal = quote("a\\b\n\"q\"'s'");

  // No bare newline (would split the line) and no bare double quote (would break the delimiter).
  // Each special char is escaped, so the literal stays faithful to the original value.
  expect(literal).not.toContain("\n");
  expect(literal).not.toContain('"');
  // Backslash to `\\`, newline to `\n`, double quote to `&quot;` (Vue decodes it), single to `\'`.
  expect(literal).toBe(String.raw`'a\\b\n&quot;q&quot;\'s\''`);
});

test("a filter value carrying a backslash + newline reaches the bound attr fully escaped", () => {
  // The user/LLM-authored `## view` filter path (slice.ts to objectExpr to quote).
  const attrs = sliceAttrs({ filter: { status: "a\\b\nc" } });
  expect(attrs).toEqual([
    { expr: String.raw`{ status: 'a\\b\nc' }`, kind: "bound", name: "filter" },
  ]);
});
