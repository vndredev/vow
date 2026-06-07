// @vitest-environment jsdom
import { expect, test } from "vite-plus/test";
import axe from "axe-core";
import { dialog, type DialogState } from "../src/index.ts";

/**
 * a11y is tested against the PLATFORM (DOM), not a framework: spread the primitive's part-props onto
 * real elements, then let axe check ARIA and real key events drive Escape + the Tab focus-trap (both
 * live in the core's keydown handler, against the event's own subtree — proven framework-free).
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

test("an open dialog is accessible DOM (axe, no framework)", async () => {
  const api = dialog({ open: true, id: "d" }, () => {});
  const content = document.createElement("div");
  applyProps(content, api.contentProps);
  const title = document.createElement("h2");
  applyProps(title, api.titleProps);
  title.textContent = "Confirm";
  const close = document.createElement("button");
  applyProps(close, api.closeProps);
  close.textContent = "x";
  content.append(title, close);
  document.body.appendChild(content);

  const results = await axe.run(content);
  expect(results.violations).toEqual([]);
  content.remove();
});

test("Escape closes", () => {
  let state: DialogState = { open: true, id: "d" };
  const api = dialog(state, (next) => {
    state = next;
  });
  const content = document.createElement("div");
  applyProps(content, api.contentProps);
  document.body.appendChild(content);

  content.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  expect(state.open).toBe(false);
  content.remove();
});

test("Tab traps focus within the content (wraps at both ends)", () => {
  const api = dialog({ open: true, id: "d" }, () => {});
  const content = document.createElement("div");
  applyProps(content, api.contentProps);
  const a = document.createElement("button");
  a.textContent = "a";
  const b = document.createElement("button");
  b.textContent = "b";
  content.append(a, b);
  document.body.appendChild(content);

  b.focus();
  content.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab" }));
  expect(document.activeElement).toBe(a); // forward off the last → first

  a.focus();
  content.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true }));
  expect(document.activeElement).toBe(b); // backward off the first → last
  content.remove();
});
