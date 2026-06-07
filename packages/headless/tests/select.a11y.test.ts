// @vitest-environment jsdom
import { expect, test } from "vite-plus/test";
import axe from "axe-core";
import { select, type SelectState } from "../src/index.ts";

/**
 * a11y is tested against the PLATFORM (DOM), not a framework: spread the primitive's part-props onto a
 * real combobox + listbox, then let axe check ARIA and a real key event drive the active highlight.
 * Focus stays on the trigger (aria-activedescendant model), so there's no per-option DOM focus.
 */
function applyProps(el: HTMLElement, props: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(props)) {
    if (key.startsWith("on") && typeof value === "function") {
      el.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    } else if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      el.setAttribute(key, String(value));
    }
  }
}

const OPTIONS = [
  { value: "vue", label: "Vue" },
  { value: "react", label: "React" },
  { value: "solid", label: "Solid" },
];

test("an open select is accessible DOM (axe, no framework)", async () => {
  const api = select(
    { value: "vue", options: OPTIONS, open: true, active: "vue", id: "fw" },
    () => {},
  );
  const root = document.createElement("div");
  const trigger = document.createElement("button");
  applyProps(trigger, api.triggerProps);
  // a combobox takes its name from a label, not its contents — the adapter binds :aria-label="label".
  trigger.setAttribute("aria-label", "Framework");
  trigger.textContent = api.selectedLabel;
  const listbox = document.createElement("ul");
  applyProps(listbox, api.listboxProps);
  for (const option of OPTIONS) {
    const li = document.createElement("li");
    applyProps(li, api.optionProps(option));
    li.textContent = option.label;
    listbox.appendChild(li);
  }
  root.append(trigger, listbox);
  document.body.appendChild(root);

  const results = await axe.run(root);
  expect(results.violations).toEqual([]);
  root.remove();
});

test("a real ArrowDown moves the active option", () => {
  let state: SelectState = { value: "vue", options: OPTIONS, open: true, active: "vue", id: "fw" };
  const api = select(state, (next) => {
    state = next;
  });
  const trigger = document.createElement("button");
  applyProps(trigger, api.triggerProps);
  document.body.appendChild(trigger);

  trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
  expect(state.active).toBe("react");
  trigger.remove();
});
