import { expect, test } from "vite-plus/test";
import { collapsible, type CollapsibleState } from "../src/index.ts";

/** A tiny stateful harness: holds state, rebuilds the api after each change. */
function harness(initial: CollapsibleState) {
  let state = initial;
  return {
    api: () =>
      collapsible(state, (next) => {
        state = next;
      }),
    get: () => state,
  };
}

test("toggle flips open", () => {
  const h = harness({ open: false, id: "x" });
  h.api().toggle();
  expect(h.get().open).toBe(true);
});

test("disabled blocks toggling and uses the native button disabled", () => {
  const h = harness({ open: false, id: "x", disabled: true });
  h.api().toggle();
  expect(h.get().open).toBe(false);
  expect(h.api().triggerProps["disabled"]).toBe(true);
});

test("trigger carries the APG contract (button + aria-expanded + wired ids)", () => {
  const api = collapsible({ open: true, id: "panel" }, () => {});
  expect(api.triggerProps["type"]).toBe("button");
  expect(api.triggerProps["aria-expanded"]).toBe(true);
  expect(api.triggerProps["id"]).toBe("panel-trigger");
  expect(api.triggerProps["aria-controls"]).toBe("panel-content");
  expect(api.contentProps["id"]).toBe("panel-content");
  expect(api.contentProps["aria-labelledby"]).toBe("panel-trigger");
  expect(api.contentProps["role"]).toBe("region");
});

test("every part mirrors state as data-state (the theming hook)", () => {
  const closed = collapsible({ open: false, id: "x" }, () => {});
  expect(closed.rootProps["data-state"]).toBe("closed");
  expect(closed.triggerProps["data-state"]).toBe("closed");
  expect(closed.contentProps["data-state"]).toBe("closed");

  const open = collapsible({ open: true, id: "x" }, () => {});
  expect(open.rootProps["data-state"]).toBe("open");
});
