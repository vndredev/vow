// @vitest-environment jsdom
import { applyProps, makeHarness } from "./harness.ts";
import { expect, test } from "vite-plus/test";
import type { RadioGroupApi } from "../src/radio-group.ts";
import axe from "axe-core";
import { radioGroup } from "../src/index.ts";

/** Spread the part-props onto real DOM, so axe + a real KeyboardEvent test the platform, not a framework. */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- the api's prop-builders return mutable Props by contract.
function buildGroup(api: RadioGroupApi, options: readonly string[]): HTMLElement {
  const group = document.createElement("div");
  applyProps(group, api.rootProps);
  for (const option of options) {
    const button = document.createElement("button");
    applyProps(button, api.radioProps(option));
    button.setAttribute("aria-label", option);
    group.append(button);
  }
  return group;
}

const STATUSES = ["todo", "doing", "done"];

test("the radio group is accessible DOM (axe, no framework)", async () => {
  const api = makeHarness({ disabled: false, options: STATUSES, value: "todo" }, radioGroup).api();
  const group = buildGroup(api, STATUSES);
  group.setAttribute("aria-label", "Status");
  document.body.append(group);

  const results = await axe.run(group);
  expect(results.violations).toEqual([]);
  group.remove();
});

test("ArrowDown moves selection to the next option (roving, wrapping)", () => {
  const rg = makeHarness({ disabled: false, options: STATUSES, value: "todo" }, radioGroup);
  const group = buildGroup(rg.api(), STATUSES);
  document.body.append(group);

  group.querySelector("button")?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
  expect(rg.get().value).toBe("doing");
  group.remove();
});
