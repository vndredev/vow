import { expect, test } from "vite-plus/test";
import type { TabsState } from "../src/tabs.ts";
import { makeHarness } from "./harness.ts";
import { tabs } from "../src/index.ts";

const ITEMS = ["vue", "react", "solid"];

test("select changes the value", () => {
  const tb = makeHarness({ id: "fw", items: ITEMS, value: "vue" }, tabs);
  tb.api().select("react");
  expect(tb.get().value).toBe("react");
});

test("tab props carry the APG contract + roving tabindex", () => {
  const api = makeHarness({ id: "fw", items: ITEMS, value: "react" }, tabs).api();
  const active = api.tabProps("react");
  const inactive = api.tabProps("vue");
  expect(active["role"]).toBe("tab");
  expect(active["aria-selected"]).toBe(true);
  expect(active["tabindex"]).toBe(0);
  expect(active["aria-controls"]).toBe("fw-panel-1");
  expect(active["id"]).toBe("fw-tab-1");
  expect(inactive["aria-selected"]).toBe(false);
  // Roving — only the active tab is tabbable.
  expect(inactive["tabindex"]).toBe(-1);
});

test("panel props are a labelled tabpanel wired to the tab", () => {
  const api = makeHarness({ id: "fw", items: ITEMS, value: "vue" }, tabs).api();
  const panel = api.panelProps("vue");
  expect(panel["role"]).toBe("tabpanel");
  expect(panel["id"]).toBe("fw-panel-0");
  expect(panel["aria-labelledby"]).toBe("fw-tab-0");
  expect(panel["data-state"]).toBe("active");
  expect(api.panelProps("react")["data-state"]).toBe("inactive");
});

test("orientation drives data-orientation + aria-orientation (default horizontal)", () => {
  const horizontal = makeHarness({ id: "fw", items: ITEMS, value: "vue" }, tabs).api();
  expect(horizontal.rootProps["data-orientation"]).toBe("horizontal");
  expect(horizontal.listProps["aria-orientation"]).toBe("horizontal");
  const verticalState: TabsState = {
    id: "fw",
    items: ITEMS,
    orientation: "vertical",
    value: "vue",
  };
  const vertical = makeHarness(verticalState, tabs).api();
  expect(vertical.listProps["aria-orientation"]).toBe("vertical");
});
