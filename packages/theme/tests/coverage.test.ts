import { VARIANTS, TONES, SIZES, DENSITIES } from "../src/vocab.ts";
import { expect, test } from "vite-plus/test";
import path from "node:path";
import { readFileSync } from "node:fs";

/**
 * The emit → theme seam, pinned. Every emittable token combination must have a matching selector
 * in `vow.css` — so adding a vocabulary value without its CSS rule fails here instead of rendering unstyled.
 */

const css = readFileSync(path.resolve(import.meta.dirname, "..", "vow.css"), "utf8");

/** Whether `vow.css` carries a `[<attr>="<value>"]` selector. */
function hasTokenSelector(attr: string, value: string): boolean {
  return css.includes(`[${attr}="${value}"]`);
}

test("every variant token has a vow.css selector", () => {
  for (const variant of VARIANTS) {
    expect(hasTokenSelector("data-variant", variant), `variant=${variant}`).toBe(true);
  }
});

test("every tone token has a vow.css selector", () => {
  for (const tone of TONES) {
    expect(hasTokenSelector("data-tone", tone), `tone=${tone}`).toBe(true);
  }
});

test("every size token has a vow.css selector", () => {
  for (const size of SIZES) {
    expect(hasTokenSelector("data-size", size), `size=${size}`).toBe(true);
  }
});

test("every density token has a vow.css selector", () => {
  for (const density of DENSITIES) {
    expect(hasTokenSelector("data-density", density), `density=${density}`).toBe(true);
  }
});
