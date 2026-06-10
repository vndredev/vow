// @vitest-environment jsdom
import { expect, test } from "vite-plus/test";
import { invokeHandler, makeHarness } from "./harness.ts";
import { checkbox } from "../src/index.ts";

test("toggle flips checked", () => {
  const cb = makeHarness({ checked: false, disabled: false }, checkbox);
  cb.api().toggle();
  expect(cb.get().checked).toBe(true);
});

test("disabled blocks toggling and uses the native button disabled", () => {
  const cb = makeHarness({ checked: false, disabled: true }, checkbox);
  cb.api().toggle();
  expect(cb.get().checked).toBe(false);
  expect(cb.api().controlProps["disabled"]).toBe(true);
});

test("control props carry the APG contract (button role + aria-checked + state)", () => {
  const { controlProps } = makeHarness({ checked: true, disabled: false }, checkbox).api();
  expect(controlProps["type"]).toBe("button");
  expect(controlProps["role"]).toBe("checkbox");
  expect(controlProps["aria-checked"]).toBe(true);
  expect(controlProps["data-state"]).toBe("checked");
});

test("every part mirrors state as data-state (the theming hook)", () => {
  const api = makeHarness({ checked: false, disabled: false }, checkbox).api();
  expect(api.rootProps["data-state"]).toBe("unchecked");
  expect(api.controlProps["data-state"]).toBe("unchecked");
  expect(api.indicatorProps["data-state"]).toBe("unchecked");
  expect(api.indicatorProps["aria-hidden"]).toBe("true");
});

test("Space toggles and prevents default (APG); Enter is prevented but never toggles", () => {
  const cb = makeHarness({ checked: false, disabled: false }, checkbox);
  const space = new KeyboardEvent("keydown", { cancelable: true, key: " " });
  invokeHandler(cb.api().controlProps, "onKeydown", space);
  expect(cb.get().checked).toBe(true);
  expect(space.defaultPrevented).toBe(true);

  const enter = new KeyboardEvent("keydown", { cancelable: true, key: "Enter" });
  invokeHandler(cb.api().controlProps, "onKeydown", enter);
  // Unchanged — Enter is not a checkbox toggle, but the native button activation is suppressed.
  expect(cb.get().checked).toBe(true);
  expect(enter.defaultPrevented).toBe(true);
});
