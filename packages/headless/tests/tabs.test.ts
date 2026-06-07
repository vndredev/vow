import { expect, test } from "vite-plus/test";
import { tabs, type TabsState } from "../src/index.ts";

/** A tiny stateful harness: holds state, rebuilds the api after each change. */
function harness(initial: TabsState) {
  let state = initial;
  return {
    api: () =>
      tabs(state, (next) => {
        state = next;
      }),
    get: () => state,
  };
}

const ITEMS = ["vue", "react", "solid"];

test("select changes the value", () => {
  const h = harness({ value: "vue", items: ITEMS, id: "fw" });
  h.api().select("react");
  expect(h.get().value).toBe("react");
});

test("tab props carry the APG contract + roving tabindex", () => {
  const api = tabs({ value: "react", items: ITEMS, id: "fw" }, () => {});
  const active = api.tabProps("react");
  const inactive = api.tabProps("vue");
  expect(active["role"]).toBe("tab");
  expect(active["aria-selected"]).toBe(true);
  expect(active["tabindex"]).toBe(0);
  expect(active["aria-controls"]).toBe("fw-panel-1");
  expect(active["id"]).toBe("fw-tab-1");
  expect(inactive["aria-selected"]).toBe(false);
  expect(inactive["tabindex"]).toBe(-1); // roving — only the active tab is tabbable
});

test("panel props are a labelled tabpanel wired to the tab", () => {
  const api = tabs({ value: "vue", items: ITEMS, id: "fw" }, () => {});
  const panel = api.panelProps("vue");
  expect(panel["role"]).toBe("tabpanel");
  expect(panel["id"]).toBe("fw-panel-0");
  expect(panel["aria-labelledby"]).toBe("fw-tab-0");
  expect(panel["data-state"]).toBe("active");
  expect(api.panelProps("react")["data-state"]).toBe("inactive");
});

test("orientation drives data-orientation + aria-orientation (default horizontal)", () => {
  const horizontal = tabs({ value: "vue", items: ITEMS, id: "fw" }, () => {});
  expect(horizontal.rootProps["data-orientation"]).toBe("horizontal");
  expect(horizontal.listProps["aria-orientation"]).toBe("horizontal");
  const vertical = tabs(
    { value: "vue", items: ITEMS, id: "fw", orientation: "vertical" },
    () => {},
  );
  expect(vertical.listProps["aria-orientation"]).toBe("vertical");
});
