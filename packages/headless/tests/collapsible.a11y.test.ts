// @vitest-environment jsdom
import { expect, test } from "vite-plus/test";
import axe from "axe-core";
import { collapsible, type CollapsibleState } from "../src/index.ts";

/**
 * a11y is tested against the PLATFORM (DOM), not a framework: spread the primitive's part-props onto
 * real elements with vanilla DOM, then let axe check ARIA and a real event drive behaviour. If the
 * agnostic core is sound here, any adapter that just forwards the props is sound too.
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

test("an open collapsible is accessible DOM (axe, no framework)", async () => {
  const api = collapsible({ open: true, id: "section" }, () => {});
  const trigger = document.createElement("button");
  applyProps(trigger, api.triggerProps);
  trigger.textContent = "Details";
  const content = document.createElement("div");
  applyProps(content, api.contentProps);
  content.textContent = "Body";
  document.body.append(trigger, content);

  const results = await axe.run(document.body);
  expect(results.violations).toEqual([]);
  trigger.remove();
  content.remove();
});

test("a real click on the trigger toggles open", () => {
  let state: CollapsibleState = { open: false, id: "section" };
  const api = collapsible(state, (next) => {
    state = next;
  });
  const trigger = document.createElement("button");
  applyProps(trigger, api.triggerProps);

  trigger.dispatchEvent(new MouseEvent("click"));
  expect(state.open).toBe(true);
});
