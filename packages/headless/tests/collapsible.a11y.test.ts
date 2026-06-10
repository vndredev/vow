// @vitest-environment jsdom
import { applyProps, makeHarness, mount } from "./harness.ts";
import { expect, test } from "vite-plus/test";
import axe from "axe-core";
import { collapsible } from "../src/index.ts";

/**
 * A11y is tested against the PLATFORM (DOM), not a framework: spread the primitive's part-props onto
 * real elements with vanilla DOM, then let axe check ARIA and a real event drive behaviour. If the
 * agnostic core is sound here, any adapter that just forwards the props is sound too.
 */

test("an open collapsible is accessible DOM (axe, no framework)", async () => {
  const api = makeHarness({ disabled: false, id: "section", open: true }, collapsible).api();
  const trigger = mount("button", api.triggerProps, "Details");
  const content = mount("div", api.contentProps, "Body");
  document.body.append(trigger, content);

  const results = await axe.run(document.body);
  expect(results.violations).toEqual([]);
  trigger.remove();
  content.remove();
});

test("a real click on the trigger toggles open", () => {
  const col = makeHarness({ disabled: false, id: "section", open: false }, collapsible);
  const trigger = document.createElement("button");
  applyProps(trigger, col.api().triggerProps);

  trigger.dispatchEvent(new MouseEvent("click"));
  expect(col.get().open).toBe(true);
});
