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

test("an explicit triggerId overrides the trigger id so a form's label can point at it", () => {
  const api = makeHarness(base({ open: true, triggerId: "statusId" }), select).api();
  expect(api.triggerProps["id"]).toBe("statusId");
  // The listbox still names the trigger, so the override stays internally consistent.
  expect(api.listboxProps["aria-labelledby"]).toBe("statusId");
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

test("a printable character type-aheads to the matching label (case-insensitive)", () => {
  const sel = makeHarness(base({ active: "vue", open: true }), select);
  // "r" jumps from Vue to React (case-insensitive, scanning forward).
  pressKey(sel.api().triggerProps, "r");
  expect(sel.get().active).toBe("react");
});

test("type-ahead scans from the active option onward, wrapping past the end", () => {
  const sel = makeHarness(base({ active: "react", open: true }), select);
  // From React, "v" finds nothing below, wraps to the top and lands on Vue.
  pressKey(sel.api().triggerProps, "v");
  expect(sel.get().active).toBe("vue");
});

test("type-ahead accumulates the buffer to disambiguate (S then o -> Solid)", () => {
  const sel = makeHarness(base({ active: "vue", open: true }), select);
  pressKey(sel.api().triggerProps, "s");
  expect(sel.get().active).toBe("solid");
  pressKey(sel.api().triggerProps, "o");
  // "so" still only matches Solid; no spurious move.
  expect(sel.get().active).toBe("solid");
  expect(sel.get().typed).toBe("so");
});

test("option props mark selected + active for the theme", () => {
  const api = makeHarness(base({ active: "react", open: true, value: "vue" }), select).api();
  expect(api.optionProps(VUE)["aria-selected"]).toBe(true);
  expect(api.optionProps(VUE)["data-state"]).toBe("checked");
  expect(api.optionProps(REACT)["data-active"]).toBe("");
  expect(api.optionProps(VUE)["id"]).toBe("fw-option-0");
});
