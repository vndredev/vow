// @vitest-environment jsdom
import type { SelectApi, SelectOption } from "../src/select.ts";
import { applyProps, makeHarness, mount } from "./harness.ts";
import { expect, test } from "vite-plus/test";
import axe from "axe-core";
import { select } from "../src/index.ts";

/**
 * A11y is tested against the PLATFORM (DOM), not a framework: spread the primitive's part-props onto a
 * real combobox + listbox, then let axe check ARIA and a real key event drive the active highlight.
 * Focus stays on the trigger (aria-activedescendant model), so there's no per-option DOM focus.
 */

const OPTIONS: SelectOption[] = [
  { label: "Vue", value: "vue" },
  { label: "React", value: "react" },
  { label: "Solid", value: "solid" },
];

// A combobox takes its name from a label, not its contents — the adapter binds :aria-label="label".
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- the api's prop-builders return mutable Props by contract.
function buildSelect(api: SelectApi): HTMLElement {
  const root = document.createElement("div");
  const trigger = mount("button", api.triggerProps, api.selectedLabel);
  trigger.setAttribute("aria-label", "Framework");
  const listbox = mount("ul", api.listboxProps);
  for (const option of OPTIONS) {
    listbox.append(mount("li", api.optionProps(option), option.label));
  }
  root.append(trigger, listbox);
  return root;
}

test("an open select is accessible DOM (axe, no framework)", async () => {
  const api = makeHarness(
    { active: "vue", disabled: false, id: "fw", open: true, options: OPTIONS, value: "vue" },
    select,
  ).api();
  const root = buildSelect(api);
  document.body.append(root);

  const results = await axe.run(root);
  expect(results.violations).toEqual([]);
  root.remove();
});

test("a real ArrowDown moves the active option", () => {
  const sel = makeHarness(
    { active: "vue", disabled: false, id: "fw", open: true, options: OPTIONS, value: "vue" },
    select,
  );
  const trigger = document.createElement("button");
  applyProps(trigger, sel.api().triggerProps);
  document.body.append(trigger);

  trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
  expect(sel.get().active).toBe("react");
  trigger.remove();
});
