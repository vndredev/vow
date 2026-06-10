// @vitest-environment jsdom
import { applyProps, makeHarness } from "./harness.ts";
import { expect, test } from "vite-plus/test";
import axe from "axe-core";
import { checkbox } from "../src/index.ts";

/**
 * A11y is tested against the PLATFORM (DOM), not a framework: spread the primitive's part-props onto
 * a real element with vanilla DOM, then let axe check ARIA and a real KeyboardEvent drive behaviour.
 * If the agnostic core is sound here, any adapter that just forwards the props is sound too.
 */

test("the checkbox control is accessible DOM (axe, no framework)", async () => {
  const api = makeHarness({ checked: false }, checkbox).api();
  const control = document.createElement("button");
  applyProps(control, api.controlProps);
  control.setAttribute("aria-label", "Done");
  document.body.append(control);

  const results = await axe.run(control);
  expect(results.violations).toEqual([]);
  control.remove();
});

test("a real Space keydown toggles through the control", () => {
  const cb = makeHarness({ checked: false }, checkbox);
  const control = document.createElement("button");
  applyProps(control, cb.api().controlProps);

  control.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));
  expect(cb.get().checked).toBe(true);
});
