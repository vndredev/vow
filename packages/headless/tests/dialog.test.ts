import { expect, test } from "vite-plus/test";
import { dialog, type DialogState } from "../src/index.ts";

/** A tiny stateful harness: holds state, rebuilds the api after each change. */
function harness(initial: DialogState) {
  let state = initial;
  return {
    api: () =>
      dialog(state, (next) => {
        state = next;
      }),
    get: () => state,
  };
}

test("close flips open to false", () => {
  const h = harness({ open: true, id: "d" });
  h.api().close();
  expect(h.get().open).toBe(false);
});

test("content props carry the modal contract", () => {
  const api = dialog({ open: true, id: "confirm" }, () => {});
  expect(api.contentProps["role"]).toBe("dialog");
  expect(api.contentProps["aria-modal"]).toBe("true");
  expect(api.contentProps["aria-labelledby"]).toBe("confirm-title");
  expect(api.contentProps["tabindex"]).toBe(-1);
  expect(api.titleProps["id"]).toBe("confirm-title");
});

test("the overlay and close button both dismiss", () => {
  const h = harness({ open: true, id: "d" });
  (h.api().overlayProps["onClick"] as () => void)();
  expect(h.get().open).toBe(false);

  const h2 = harness({ open: true, id: "d" });
  (h2.api().closeProps["onClick"] as () => void)();
  expect(h2.get().open).toBe(false);
  expect(h2.api().closeProps["aria-label"]).toBe("Close");
});

test("every part mirrors state as data-state (the theming hook)", () => {
  const open = dialog({ open: true, id: "d" }, () => {});
  expect(open.overlayProps["data-state"]).toBe("open");
  expect(open.contentProps["data-state"]).toBe("open");
  const closed = dialog({ open: false, id: "d" }, () => {});
  expect(closed.contentProps["data-state"]).toBe("closed");
});
