// @vitest-environment jsdom
import { expect, test } from "vite-plus/test";
import axe from "axe-core";
import { switch_, type SwitchState } from "../src/index.ts";

/**
 * a11y is tested against the PLATFORM (DOM), not a framework: spread the primitive's part-props onto
 * a real element with vanilla DOM, then let axe check ARIA and a real KeyboardEvent drive behaviour.
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

test("the switch control is accessible DOM (axe, no framework)", async () => {
  const api = switch_({ checked: false }, () => {});
  const control = document.createElement("button");
  applyProps(control, api.controlProps);
  control.setAttribute("aria-label", "Notifications");
  document.body.appendChild(control);

  const results = await axe.run(control);
  expect(results.violations).toEqual([]);
  control.remove();
});

test("a real Space keydown toggles through the control", () => {
  let state: SwitchState = { checked: false };
  const api = switch_(state, (next) => {
    state = next;
  });
  const control = document.createElement("button");
  applyProps(control, api.controlProps);

  control.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));
  expect(state.checked).toBe(true);
});

test("Enter also toggles a switch", () => {
  let state: SwitchState = { checked: true };
  const api = switch_(state, (next) => {
    state = next;
  });
  const control = document.createElement("button");
  applyProps(control, api.controlProps);

  control.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
  expect(state.checked).toBe(false);
});
