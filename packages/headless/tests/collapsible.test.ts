import { expect, test } from "vite-plus/test";
import { collapsible } from "../src/index.ts";
import { makeHarness } from "./harness.ts";

test("toggle flips open", () => {
  const col = makeHarness({ disabled: false, id: "x", open: false }, collapsible);
  col.api().toggle();
  expect(col.get().open).toBe(true);
});

test("disabled blocks toggling and uses the native button disabled", () => {
  const col = makeHarness({ disabled: true, id: "x", open: false }, collapsible);
  col.api().toggle();
  expect(col.get().open).toBe(false);
  expect(col.api().triggerProps["disabled"]).toBe(true);
});

test("trigger carries the APG contract (button + aria-expanded + wired ids)", () => {
  const api = makeHarness({ disabled: false, id: "panel", open: true }, collapsible).api();
  expect(api.triggerProps["type"]).toBe("button");
  expect(api.triggerProps["aria-expanded"]).toBe(true);
  expect(api.triggerProps["id"]).toBe("panel-trigger");
  expect(api.triggerProps["aria-controls"]).toBe("panel-content");
  expect(api.contentProps["id"]).toBe("panel-content");
  expect(api.contentProps["aria-labelledby"]).toBe("panel-trigger");
  expect(api.contentProps["role"]).toBe("region");
});

test("every part mirrors state as data-state (the theming hook)", () => {
  const closed = makeHarness({ disabled: false, id: "x", open: false }, collapsible).api();
  expect(closed.rootProps["data-state"]).toBe("closed");
  expect(closed.triggerProps["data-state"]).toBe("closed");
  expect(closed.contentProps["data-state"]).toBe("closed");

  const open = makeHarness({ disabled: false, id: "x", open: true }, collapsible).api();
  expect(open.rootProps["data-state"]).toBe("open");
});
