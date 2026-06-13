import { CONTROL_SIZES, SIZE_DEFAULT, TONES, VARIANTS } from "../src/vocab.ts";
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
  for (const variant of VARIANTS) {
    expect(hasSelector("vow-badge", "data-variant", variant), variant).toBe(true);
  }
});

test("every badge tone has a vow.css selector (neutral is the base rule)", () => {
  for (const tone of TONES) {
    const exempt = tone === "neutral";
    expect(hasSelector("vow-badge", "data-tone", tone) || exempt, tone).toBe(true);
  }
});

test("every button variant has a vow.css selector", () => {
  for (const variant of VARIANTS) {
    expect(hasSelector("vow-button", "data-variant", variant), variant).toBe(true);
  }
});

test("every button tone has a vow.css selector (neutral is the base rule)", () => {
  for (const tone of TONES) {
    const exempt = tone === "neutral";
    expect(hasSelector("vow-button", "data-tone", tone) || exempt, tone).toBe(true);
  }
});

test("every non-default size has a vow.css selector (the default is the base `.vow-button` rule)", () => {
  for (const size of CONTROL_SIZES) {
    const exempt = size === SIZE_DEFAULT;
    expect(hasSelector("vow-button", "data-size", size) || exempt, size).toBe(true);
  }
});

test("the base-styled size default deliberately has no own selector", () => {
  expect(hasSelector("vow-button", "data-size", SIZE_DEFAULT)).toBe(false);
});
