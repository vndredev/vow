// @vitest-environment jsdom
import type { SelectOption, SelectState } from "../src/select.ts";
import { expect, test } from "vite-plus/test";
import { invokeHandler, makeHarness } from "./harness.ts";
import { select } from "../src/index.ts";

const VUE: SelectOption = { label: "Vue", value: "vue" };
const REACT: SelectOption = { label: "React", value: "react" };
const SOLID: SelectOption = { label: "Solid", value: "solid" };
const OPTIONS = [VUE, REACT, SOLID];

function base(over: Readonly<Partial<SelectState>>): SelectState {
  return {
    active: "vue",
    disabled: false,
    id: "fw",
    open: false,
    options: OPTIONS,
    value: "vue",
    ...over,
  };
}

function pressKey(props: Readonly<Record<string, unknown>>, key: string): void {
  invokeHandler(props, "onKeydown", new KeyboardEvent("keydown", { key }));
}

test("select commits a value and closes", () => {
  const sel = makeHarness(base({ open: true }), select);
  sel.api().select("react");
  expect(sel.get().value).toBe("react");
  expect(sel.get().open).toBe(false);
});

test("clicking the trigger opens with the selected option active", () => {
  const sel = makeHarness(base({ active: "react", value: "react" }), select);
  invokeHandler(sel.api().triggerProps, "onClick", new Event("click"));
  expect(sel.get().open).toBe(true);
  expect(sel.get().active).toBe("react");
});

test("trigger carries the combobox contract", () => {
  const api = makeHarness(base({ active: "react", open: true }), select).api();
  expect(api.triggerProps["role"]).toBe("combobox");
  expect(api.triggerProps["aria-haspopup"]).toBe("listbox");
  expect(api.triggerProps["aria-expanded"]).toBe(true);
  expect(api.triggerProps["aria-controls"]).toBe("fw-listbox");
  expect(api.triggerProps["aria-activedescendant"]).toBe("fw-option-1");
  expect(api.selectedLabel).toBe("Vue");
});

test("arrows move the active highlight (wrapping); Enter commits it", () => {
  const sel = makeHarness(base({ active: "solid", open: true }), select);
  // Wraps solid -> vue.
  pressKey(sel.api().triggerProps, "ArrowDown");
  expect(sel.get().active).toBe("vue");
  // Wraps vue -> solid.
  pressKey(sel.api().triggerProps, "ArrowUp");
  expect(sel.get().active).toBe("solid");
  pressKey(sel.api().triggerProps, "Home");
  expect(sel.get().active).toBe("vue");
  pressKey(sel.api().triggerProps, "Enter");
  expect(sel.get().value).toBe("vue");
  expect(sel.get().open).toBe(false);
});

test("Escape closes without committing", () => {
  const sel = makeHarness(base({ active: "react", open: true, value: "vue" }), select);
  pressKey(sel.api().triggerProps, "Escape");
  expect(sel.get().open).toBe(false);
  expect(sel.get().value).toBe("vue");
});

test("option props mark selected + active for the theme", () => {
  const api = makeHarness(base({ active: "react", open: true, value: "vue" }), select).api();
  expect(api.optionProps(VUE)["aria-selected"]).toBe(true);
  expect(api.optionProps(VUE)["data-state"]).toBe("checked");
  expect(api.optionProps(REACT)["data-active"]).toBe("");
  expect(api.optionProps(VUE)["id"]).toBe("fw-option-0");
});
