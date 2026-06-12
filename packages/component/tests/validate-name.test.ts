import { assertAttrName, assertObjectKey } from "../src/validate-name.ts";
import { expect, test } from "vite-plus/test";

/*
 * The name guards (#305): a bound attribute renders as `:<name>="<expr>"` and an object-literal key as
 * `<key>: <value>` — both put the name OUTSIDE a quoted string, so a hostile `## view` key would break
 * out (run JS, forge a directive). These tests pin the safe shapes — every legitimate name passes, every
 * breakout is rejected — mirroring the value-escaping defense (#283/#299) on the name path.
 */

/** Assert calling `guard(name)` throws (the arrow has a void-returning body, not a shorthand return). */
function rejects(guard: (name: string) => void, name: string): void {
  expect(() => {
    guard(name);
  }).toThrow();
}

test("assertObjectKey accepts a bare identifier, rejects an expression breakout", () => {
  // The real filter keys are entity field names — bare identifiers.
  for (const ok of ["status", "priority", "of", "by", "_x", "$ref", "a1"]) {
    expect(() => {
      assertObjectKey(ok);
    }).not.toThrow();
  }
  // The confirmed breakout: a key that closes the literal and runs `alert(1)` on render.
  expect(() => {
    assertObjectKey("a }; alert(1); ({");
  }).toThrow(/not a safe identifier/u);
  for (const bad of ["a-b", "1a", ""]) {
    rejects(assertObjectKey, bad);
  }
});

test("assertAttrName accepts a real attribute name, rejects a directive forge", () => {
  // The real bound-attr names — including hyphen / `data-`/`aria-` and the camelCase `modelValue`.
  for (const ok of ["aria-label", "data-size", "modelValue", "control-id", "href", "x.y", "ns:a"]) {
    expect(() => {
      assertAttrName(ok);
    }).not.toThrow();
  }
  // The confirmed breakout: a key that closes the attr and forges a real `@click` handler.
  expect(() => {
    assertAttrName('class="x" @click');
  }).toThrow(/not a safe attribute name/u);
  for (const bad of ["a b", "-x", ""]) {
    rejects(assertAttrName, bad);
  }
});
