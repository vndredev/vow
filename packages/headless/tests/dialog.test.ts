import { expect, test } from "vite-plus/test";
import { invokeHandler, makeHarness } from "./harness.ts";
import { dialog } from "../src/index.ts";

test("close flips open to false", () => {
  const dlg = makeHarness({ id: "d", open: true }, dialog);
  dlg.api().close();
  expect(dlg.get().open).toBe(false);
});

test("content props carry the modal contract", () => {
  const api = makeHarness({ id: "confirm", open: true }, dialog).api();
  expect(api.contentProps["role"]).toBe("dialog");
  expect(api.contentProps["aria-modal"]).toBe("true");
  expect(api.contentProps["aria-labelledby"]).toBe("confirm-title");
  expect(api.contentProps["tabindex"]).toBe(-1);
  expect(api.titleProps["id"]).toBe("confirm-title");
});

test("the overlay and close button both dismiss", () => {
  const viaOverlay = makeHarness({ id: "d", open: true }, dialog);
  invokeHandler(viaOverlay.api().overlayProps, "onClick", new Event("click"));
  expect(viaOverlay.get().open).toBe(false);

  const viaClose = makeHarness({ id: "d", open: true }, dialog);
  invokeHandler(viaClose.api().closeProps, "onClick", new Event("click"));
  expect(viaClose.get().open).toBe(false);
  expect(viaClose.api().closeProps["aria-label"]).toBe("Close");
});

test("every part mirrors state as data-state (the theming hook)", () => {
  const open = makeHarness({ id: "d", open: true }, dialog).api();
  expect(open.overlayProps["data-state"]).toBe("open");
  expect(open.contentProps["data-state"]).toBe("open");
  const closed = makeHarness({ id: "d", open: false }, dialog).api();
  expect(closed.contentProps["data-state"]).toBe("closed");
});
