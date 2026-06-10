// @vitest-environment jsdom
import { expect, test } from "vite-plus/test";
import { makeHarness, mount } from "./harness.ts";
import type { TabsApi } from "../src/tabs.ts";
import axe from "axe-core";
import { tabs } from "../src/index.ts";

/**
 * A11y is tested against the PLATFORM (DOM), not a framework: spread the primitive's part-props onto
 * real elements, then let axe check ARIA and a real key event drive roving focus. The focus move lives
 * in the core's keydown handler (against the event's own subtree), so it is proven here, framework-free.
 */

const ITEMS = ["vue", "react", "solid"];

/**
 * A `<main>` landmark holds the widget so axe's page-structure "region" rule is satisfied — that leaves
 * the tabs' own ARIA under test. Each tab + panel pair is built from the api's part-props.
 */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- the api's prop-builders return mutable Props by contract.
function buildTablist(api: TabsApi): HTMLElement {
  const main = document.createElement("main");
  const list = mount("div", api.listProps);
  main.append(list);
  for (const item of ITEMS) {
    list.append(mount("button", api.tabProps(item), item));
    main.append(mount("div", api.panelProps(item), `${item} panel`));
  }
  return main;
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- the api's prop-builders return mutable Props by contract.
function buildTabButtons(api: TabsApi, list: HTMLElement): HTMLElement[] {
  return ITEMS.map((item) => {
    const tab = mount("button", api.tabProps(item));
    list.append(tab);
    return tab;
  });
}

test("a tablist with tabs + panels is accessible DOM (axe, no framework)", async () => {
  const api = makeHarness({ id: "fw", items: ITEMS, value: "vue" }, tabs).api();
  const main = buildTablist(api);
  document.body.append(main);

  const results = await axe.run(document.body);
  expect(results.violations).toEqual([]);
  main.remove();
});

test("ArrowRight selects and moves roving focus to the next tab", () => {
  const tb = makeHarness({ id: "fw", items: ITEMS, value: "vue" }, tabs);
  const list = mount("div", tb.api().listProps);
  const tabEls = buildTabButtons(tb.api(), list);
  document.body.append(list);

  const [firstTab, secondTab] = tabEls;
  firstTab?.focus();
  firstTab?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
  expect(tb.get().value).toBe("react");
  expect(document.activeElement).toBe(secondTab);
  list.remove();
});
