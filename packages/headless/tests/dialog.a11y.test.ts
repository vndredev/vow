// @vitest-environment jsdom
import { applyProps, makeHarness, mount } from "./harness.ts";
import { expect, test } from "vite-plus/test";
import axe from "axe-core";
import { dialog } from "../src/index.ts";

/**
 * A11y is tested against the PLATFORM (DOM), not a framework: spread the primitive's part-props onto
 * real elements, then let axe check ARIA and real key events drive Escape + the Tab focus-trap (both
 * live in the core's keydown handler, against the event's own subtree — proven framework-free).
 */

test("an open dialog is accessible DOM (axe, no framework)", async () => {
  const api = makeHarness({ id: "d", open: true }, dialog).api();
  const content = mount("div", api.contentProps);
  content.append(mount("h2", api.titleProps, "Confirm"), mount("button", api.closeProps, "x"));
  document.body.append(content);

  const results = await axe.run(content);
  expect(results.violations).toEqual([]);
  content.remove();
});

test("Escape closes", () => {
  const dlg = makeHarness({ id: "d", open: true }, dialog);
  const content = document.createElement("div");
  applyProps(content, dlg.api().contentProps);
  document.body.append(content);

  content.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  expect(dlg.get().open).toBe(false);
  content.remove();
});

/** A two-button dialog content mounted in the document, returning the content + its focus edges. */
function mountTrap(): { content: HTMLElement; firstBtn: HTMLElement; lastBtn: HTMLElement } {
  const api = makeHarness({ id: "d", open: true }, dialog).api();
  const content = mount("div", api.contentProps);
  const firstBtn = mount("button", {}, "a");
  const lastBtn = mount("button", {}, "b");
  content.append(firstBtn, lastBtn);
  document.body.append(content);
  return { content, firstBtn, lastBtn };
}

test("Tab traps focus within the content (wraps at both ends)", () => {
  const { content, firstBtn, lastBtn } = mountTrap();

  lastBtn.focus();
  content.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab" }));
  // Forward off the last wraps to the first.
  expect(document.activeElement).toBe(firstBtn);

  firstBtn.focus();
  content.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true }));
  // Backward off the first wraps to the last.
  expect(document.activeElement).toBe(lastBtn);
  content.remove();
});
