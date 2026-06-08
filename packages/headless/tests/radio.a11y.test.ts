// @vitest-environment jsdom
import { expect, test } from "vite-plus/test";
import axe from "axe-core";
import { radioGroup, type RadioGroupState } from "../src/index.ts";

/** Spread the part-props onto real DOM, so axe + a real KeyboardEvent test the platform, not a framework. */
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

function buildGroup(state: RadioGroupState, set: (next: RadioGroupState) => void): HTMLElement {
  const api = radioGroup(state, set);
  const group = document.createElement("div");
  applyProps(group, api.rootProps);
  for (const option of state.options) {
    const btn = document.createElement("button");
    applyProps(btn, api.radioProps(option));
    btn.setAttribute("aria-label", option);
    group.appendChild(btn);
  }
  return group;
}

test("the radio group is accessible DOM (axe, no framework)", async () => {
  const group = buildGroup({ value: "todo", options: ["todo", "doing", "done"] }, () => {});
  group.setAttribute("aria-label", "Status");
  document.body.appendChild(group);

  const results = await axe.run(group);
  expect(results.violations).toEqual([]);
  group.remove();
});

test("ArrowDown moves selection to the next option (roving, wrapping)", () => {
  let state: RadioGroupState = { value: "todo", options: ["todo", "doing", "done"] };
  const group = buildGroup(state, (next) => {
    state = next;
  });
  document.body.appendChild(group);

  group.querySelector("button")?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
  expect(state.value).toBe("doing");
  group.remove();
});
