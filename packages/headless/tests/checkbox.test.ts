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

test("disabled blocks toggling and uses the native button disabled", () => {
  const h = harness({ checked: false, disabled: true });
  h.api().toggle();
  expect(h.get().checked).toBe(false);
  expect(h.api().controlProps["disabled"]).toBe(true);
});

test("control props carry the APG contract (button role + aria-checked + state)", () => {
  const api = checkbox({ checked: true }, () => {});
  expect(api.controlProps["type"]).toBe("button");
  expect(api.controlProps["role"]).toBe("checkbox");
  expect(api.controlProps["aria-checked"]).toBe(true);
  expect(api.controlProps["data-state"]).toBe("checked");
});

test("every part mirrors state as data-state (the theming hook)", () => {
  const api = checkbox({ checked: false }, () => {});
  expect(api.rootProps["data-state"]).toBe("unchecked");
  expect(api.controlProps["data-state"]).toBe("unchecked");
  expect(api.indicatorProps["data-state"]).toBe("unchecked");
  expect(api.indicatorProps["aria-hidden"]).toBe("true");
});

test("Space toggles and prevents default (APG); Enter is prevented but never toggles", () => {
  const h = harness({ checked: false });
  let prevented = false;
  const space = { key: " ", preventDefault: () => (prevented = true) } as unknown as KeyboardEvent;
  onKeydown(h.api())(space);
  expect(h.get().checked).toBe(true);
  expect(prevented).toBe(true);

  let enterPrevented = false;
  const enter = {
    key: "Enter",
    preventDefault: () => (enterPrevented = true),
  } as unknown as KeyboardEvent;
  onKeydown(h.api())(enter);
  expect(h.get().checked).toBe(true); // unchanged — Enter is not a checkbox toggle
  expect(enterPrevented).toBe(true); // but the native button activation is suppressed
});
