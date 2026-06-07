// @vitest-environment jsdom
import { expect, test } from "vite-plus/test";
import axe from "axe-core";
import { tabs, type TabsState } from "../src/index.ts";

/**
 * a11y is tested against the PLATFORM (DOM), not a framework: spread the primitive's part-props onto
 * real elements, then let axe check ARIA and a real key event drive roving focus. The focus move lives
 * in the core's keydown handler (against the event's own subtree), so it is proven here, framework-free.
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

const ITEMS = ["vue", "react", "solid"];

test("a tablist with tabs + panels is accessible DOM (axe, no framework)", async () => {
  const api = tabs({ value: "vue", items: ITEMS, id: "fw" }, () => {});
  // a <main> landmark holds the widget — so axe's page-structure "region" rule (all content must live
  // in a landmark) is satisfied and we test the tabs' own ARIA, not the harness's lack of page chrome.
  const main = document.createElement("main");
  const list = document.createElement("div");
  applyProps(list, api.listProps);
  main.appendChild(list);
  for (const item of ITEMS) {
    const tab = document.createElement("button");
    applyProps(tab, api.tabProps(item));
    tab.textContent = item;
    list.appendChild(tab);
    const panel = document.createElement("div");
    applyProps(panel, api.panelProps(item));
    panel.textContent = `${item} panel`;
    main.appendChild(panel);
  }
  document.body.appendChild(main);

  const results = await axe.run(document.body);
  expect(results.violations).toEqual([]);
  main.remove();
});

test("ArrowRight selects and moves roving focus to the next tab", () => {
  let state: TabsState = { value: "vue", items: ITEMS, id: "fw" };
  const api = tabs(state, (next) => {
    state = next;
  });
  const list = document.createElement("div");
  applyProps(list, api.listProps);
  const tabEls = ITEMS.map((item) => {
    const tab = document.createElement("button");
    applyProps(tab, api.tabProps(item));
    list.appendChild(tab);
    return tab;
  });
  document.body.appendChild(list);

  tabEls[0]?.focus();
  tabEls[0]?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
  expect(state.value).toBe("react");
  expect(document.activeElement).toBe(tabEls[1]);
  list.remove();
});
