// @vitest-environment jsdom
import type { ContextMenuItem, ContextMenuState } from "../src/context-menu.ts";
import { expect, test } from "vite-plus/test";
import { invokeHandler, makeHarness } from "./harness.ts";
import { contextMenu } from "../src/index.ts";

const EDIT: ContextMenuItem = { label: "Edit", value: "edit" };
const RENAME: ContextMenuItem = { label: "Rename", value: "rename" };
const DELETE: ContextMenuItem = { label: "Delete", value: "delete" };
const ITEMS = [EDIT, RENAME, DELETE];

function base(over: Readonly<Partial<ContextMenuState>>): ContextMenuState {
  return {
    active: "edit",
    id: "ctx",
    items: ITEMS,
    open: false,
    ...over,
  };
}

function pressKey(props: Readonly<Record<string, unknown>>, key: string): void {
  invokeHandler(props, "onKeydown", new KeyboardEvent("keydown", { key }));
}

test("clicking an item commits its value and closes the menu", () => {
  const menu = makeHarness(base({ open: true }), contextMenu);
  invokeHandler(menu.api().itemProps(DELETE), "onClick", new Event("click"));
  expect(menu.get().chosen).toBe("delete");
  expect(menu.get().open).toBe(false);
});

test("Escape closes the menu without choosing", () => {
  const menu = makeHarness(base({ open: true }), contextMenu);
  pressKey(menu.api().panelProps, "Escape");
  expect(menu.get().open).toBe(false);
  expect(menu.get().chosen).toBeUndefined();
});

test("ArrowDown moves the highlight; Enter commits the active item", () => {
  const menu = makeHarness(base({ active: "edit", open: true }), contextMenu);
  pressKey(menu.api().panelProps, "ArrowDown");
  expect(menu.get().active).toBe("rename");
  pressKey(menu.api().panelProps, "Enter");
  expect(menu.get().chosen).toBe("rename");
  expect(menu.get().open).toBe(false);
});

test("ArrowUp wraps to the last item; Home/End jump to the edges", () => {
  const menu = makeHarness(base({ active: "edit", open: true }), contextMenu);
  pressKey(menu.api().panelProps, "ArrowUp");
  expect(menu.get().active).toBe("delete");
  pressKey(menu.api().panelProps, "Home");
  expect(menu.get().active).toBe("edit");
  pressKey(menu.api().panelProps, "End");
  expect(menu.get().active).toBe("delete");
});

test("the panel carries the menu contract; the active item is marked", () => {
  const api = makeHarness(base({ active: "rename", open: true }), contextMenu).api();
  expect(api.panelProps["role"]).toBe("menu");
  expect(api.panelProps["aria-activedescendant"]).toBe("ctx-item-1");
  expect(api.itemProps(RENAME)["data-active"]).toBe("");
  expect(api.itemProps(EDIT)["data-active"]).toBeUndefined();
});

test("Tab closes the menu", () => {
  const menu = makeHarness(base({ open: true }), contextMenu);
  pressKey(menu.api().panelProps, "Tab");
  expect(menu.get().open).toBe(false);
});
