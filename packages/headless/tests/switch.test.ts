import { expect, test } from "vite-plus/test";
import { switch_ } from "../src/index.ts";

test("switch_ exposes role=switch + aria-checked and toggles", () => {
  let checked = false;
  const api = switch_({ checked }, (next) => {
    checked = next.checked;
  });
  expect(api.controlProps["role"]).toBe("switch");
  expect(api.controlProps["aria-checked"]).toBe(false);
  api.toggle();
  expect(checked).toBe(true);
});

test("a disabled switch does not toggle and is inert", () => {
  let checked = false;
  const api = switch_({ checked, disabled: true }, (next) => {
    checked = next.checked;
  });
  api.toggle();
  expect(checked).toBe(false);
  expect(api.controlProps["disabled"]).toBe(true);
});

test("the data-state hook reflects the checked state", () => {
  expect(switch_({ checked: true }, () => {}).rootProps["data-state"]).toBe("checked");
  expect(switch_({ checked: false }, () => {}).rootProps["data-state"]).toBe("unchecked");
});
