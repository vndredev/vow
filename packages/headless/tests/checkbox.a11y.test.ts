// @vitest-environment jsdom
import { expect, test } from "vite-plus/test";
import axe from "axe-core";
import { checkbox, type CheckboxState } from "../src/index.ts";

/**
 * a11y is tested against the PLATFORM (DOM), not a framework: spread the primitive's part-props onto
 * a real element with vanilla DOM, then let axe check ARIA and a real KeyboardEvent drive behaviour.
 * If the agnostic core is sound here, any adapter that just forwards the props is sound too.
 */
function applyProps(el: HTMLElement, props: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(props)) {
    if (key.startsWith("on") && typeof value === "function") {
      el.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    } else if (value !== undefined && typeof value !== "function") {
      el.setAttribute(key, String(value));
    }
  }
}

test("the checkbox control is accessible DOM (axe, no framework)", async () => {
  const api = checkbox({ checked: false }, () => {});
  const control = document.createElement("span");
  applyProps(control, api.controlProps);
  control.setAttribute("aria-label", "Erledigt");
  document.body.appendChild(control);

  const results = await axe.run(control);
  expect(results.violations).toEqual([]);
  control.remove();
});

test("a real Space keydown toggles through the control", () => {
  let state: CheckboxState = { checked: false };
  const api = checkbox(state, (next) => {
    state = next;
  });
  const control = document.createElement("span");
  applyProps(control, api.controlProps);

  control.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));
  expect(state.checked).toBe(true);
});
