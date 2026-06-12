import { BADGE_VARIANTS, BUTTON_VARIANTS, SIZES, SIZE_DEFAULT } from "../src/vocab.ts";
import { expect, test } from "vite-plus/test";
import path from "node:path";
import { readFileSync } from "node:fs";

/**
 * The emit -> theme seam, pinned. Every value the emitters write as a `data-variant`/`data-size` must have a
 * matching selector in `vow.css` (or, for the base-styled size default, be deliberately exempt) — so adding
 * a vocabulary value without its CSS rule, or renaming a selector, fails here instead of rendering unstyled.
 */

const css = readFileSync(path.resolve(import.meta.dirname, "..", "vow.css"), "utf8");

/** Whether `vow.css` carries a `.<element>[<attr>="<value>"]` selector. */
function hasSelector(element: string, attr: string, value: string): boolean {
  return css.includes(`.${element}[${attr}="${value}"]`);
}

test("every badge variant has a vow.css selector", () => {
  for (const variant of BADGE_VARIANTS) {
    expect(hasSelector("vow-badge", "data-variant", variant), variant).toBe(true);
  }
});

test("every button variant has a vow.css selector", () => {
  for (const variant of BUTTON_VARIANTS) {
    expect(hasSelector("vow-button", "data-variant", variant), variant).toBe(true);
  }
});

test("every non-default size has a vow.css selector (the default is the base `.vow-button` rule)", () => {
  for (const size of SIZES) {
    const exempt = size === SIZE_DEFAULT;
    expect(hasSelector("vow-button", "data-size", size) || exempt, size).toBe(true);
  }
});

test("the base-styled size default deliberately has no own selector", () => {
  expect(hasSelector("vow-button", "data-size", SIZE_DEFAULT)).toBe(false);
});
