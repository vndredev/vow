import { expect, test } from "vite-plus/test";
import { checkbox, type CheckboxState } from "../src/index.ts";

/** A tiny stateful harness: holds state, rebuilds the api after each change. */
function harness(initial: CheckboxState) {
  let state = initial;
  return {
    api: () =>
      checkbox(state, (next) => {
        state = next;
      }),
    get: () => state,
  };
}

const onKeydown = (api: ReturnType<typeof checkbox>): ((e: KeyboardEvent) => void) =>
  api.controlProps["onKeydown"] as (e: KeyboardEvent) => void;

test("toggle flips checked", () => {
  const h = harness({ checked: false });
  h.api().toggle();
  expect(h.get().checked).toBe(true);
});

test("disabled blocks toggling and leaves the tab order", () => {
  const h = harness({ checked: false, disabled: true });
  h.api().toggle();
  expect(h.get().checked).toBe(false);
  expect(h.api().controlProps["tabindex"]).toBe(-1);
});

test("control props carry the APG contract (role + aria-checked)", () => {
  const api = checkbox({ checked: true }, () => {});
  expect(api.controlProps["role"]).toBe("checkbox");
  expect(api.controlProps["aria-checked"]).toBe(true);
  expect(api.controlProps["tabindex"]).toBe(0);
});

test("Space toggles and prevents default (APG); other keys do not", () => {
  const h = harness({ checked: false });
  let prevented = false;
  const space = { key: " ", preventDefault: () => (prevented = true) } as unknown as KeyboardEvent;
  onKeydown(h.api())(space);
  expect(h.get().checked).toBe(true);
  expect(prevented).toBe(true);

  const enter = { key: "Enter", preventDefault: () => {} } as unknown as KeyboardEvent;
  onKeydown(h.api())(enter);
  expect(h.get().checked).toBe(true); // unchanged — Enter is not a checkbox toggle
});
