import { expect, test } from "vite-plus/test";
import { makeHarness } from "./harness.ts";
import { radioGroup } from "../src/index.ts";

const STATUSES = ["todo", "doing", "done"];

test("radioGroup exposes role=radiogroup + role=radio with aria-checked and roving tabindex", () => {
  const api = makeHarness({ disabled: false, options: STATUSES, value: "doing" }, radioGroup).api();
  expect(api.rootProps["role"]).toBe("radiogroup");
  expect(api.radioProps("doing")["role"]).toBe("radio");
  expect(api.radioProps("doing")["aria-checked"]).toBe(true);
  // The checked option is tabbable; the rest are not.
  expect(api.radioProps("doing")["tabindex"]).toBe(0);
  expect(api.radioProps("todo")["tabindex"]).toBe(-1);
});

test("the first option is tabbable when nothing is selected yet", () => {
  const api = makeHarness({ disabled: false, options: ["a", "b"], value: "" }, radioGroup).api();
  expect(api.radioProps("a")["tabindex"]).toBe(0);
  expect(api.radioProps("b")["tabindex"]).toBe(-1);
});

test("a disabled group does not select", () => {
  const rg = makeHarness({ disabled: true, options: ["a", "b"], value: "a" }, radioGroup);
  rg.api().select("b");
  expect(rg.get().value).toBe("a");
});
