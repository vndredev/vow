// @vitest-environment jsdom
import { applyProps, makeHarness } from "./harness.ts";
import { expect, test } from "vite-plus/test";
import axe from "axe-core";
import { switch_ } from "../src/index.ts";

/**
 * A11y is tested against the PLATFORM (DOM), not a framework: spread the primitive's part-props onto
 * a real element with vanilla DOM, then let axe check ARIA and a real KeyboardEvent drive behaviour.
 */

test("the switch control is accessible DOM (axe, no framework)", async () => {
  const api = makeHarness({ checked: false, disabled: false }, switch_).api();
  const control = document.createElement("button");
  applyProps(control, api.controlProps);
  control.setAttribute("aria-label", "Notifications");
  document.body.append(control);

  const results = await axe.run(control);
  expect(results.violations).toEqual([]);
  control.remove();
});

test("a real Space keydown toggles through the control", () => {
  const sw = makeHarness({ checked: false, disabled: false }, switch_);
  const control = document.createElement("button");
  applyProps(control, sw.api().controlProps);

  control.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));
  expect(sw.get().checked).toBe(true);
});

test("Enter also toggles a switch", () => {
  const sw = makeHarness({ checked: true, disabled: false }, switch_);
  const control = document.createElement("button");
  applyProps(control, sw.api().controlProps);

  control.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
  expect(sw.get().checked).toBe(false);
});
