import { expect, test } from "vite-plus/test";
import { radioGroup } from "../src/index.ts";

test("radioGroup exposes role=radiogroup + role=radio with aria-checked and roving tabindex", () => {
  const api = radioGroup({ value: "doing", options: ["todo", "doing", "done"] }, () => {});
  expect(api.rootProps["role"]).toBe("radiogroup");
  expect(api.radioProps("doing")["role"]).toBe("radio");
  expect(api.radioProps("doing")["aria-checked"]).toBe(true);
  expect(api.radioProps("doing")["tabindex"]).toBe(0); // the checked option is tabbable
  expect(api.radioProps("todo")["tabindex"]).toBe(-1); // the rest are not
});

test("the first option is tabbable when nothing is selected yet", () => {
  const api = radioGroup({ value: "", options: ["a", "b"] }, () => {});
  expect(api.radioProps("a")["tabindex"]).toBe(0);
  expect(api.radioProps("b")["tabindex"]).toBe(-1);
});

test("a disabled group does not select", () => {
  let value = "a";
  const api = radioGroup({ value, options: ["a", "b"], disabled: true }, (next) => {
    value = next.value;
  });
  api.select("b");
  expect(value).toBe("a");
});
