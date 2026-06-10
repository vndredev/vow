import { expect, test } from "vite-plus/test";
import { makeHarness } from "./harness.ts";
import { switch_ } from "../src/index.ts";

test("switch_ exposes role=switch + aria-checked and toggles", () => {
  const sw = makeHarness({ checked: false, disabled: false }, switch_);
  expect(sw.api().controlProps["role"]).toBe("switch");
  expect(sw.api().controlProps["aria-checked"]).toBe(false);
  sw.api().toggle();
  expect(sw.get().checked).toBe(true);
});

test("a disabled switch does not toggle and is inert", () => {
  const sw = makeHarness({ checked: false, disabled: true }, switch_);
  sw.api().toggle();
  expect(sw.get().checked).toBe(false);
  expect(sw.api().controlProps["disabled"]).toBe(true);
});

test("the data-state hook reflects the checked state", () => {
  const on = makeHarness({ checked: true, disabled: false }, switch_);
  const off = makeHarness({ checked: false, disabled: false }, switch_);
  expect(on.api().rootProps["data-state"]).toBe("checked");
  expect(off.api().rootProps["data-state"]).toBe("unchecked");
});
