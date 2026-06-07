import { expect, test } from "vite-plus/test";
import { select, type SelectState } from "../src/index.ts";

const OPTIONS = [
  { value: "vue", label: "Vue" },
  { value: "react", label: "React" },
  { value: "solid", label: "Solid" },
];

/** A tiny stateful harness: holds state, rebuilds the api after each change. */
function harness(initial: SelectState) {
  let state = initial;
  return {
    api: () =>
      select(state, (next) => {
        state = next;
      }),
    get: () => state,
  };
}

const base = (over: Partial<SelectState> = {}): SelectState => ({
  value: "vue",
  options: OPTIONS,
  open: false,
  active: "vue",
  id: "fw",
  ...over,
});

const onKeydown = (api: ReturnType<typeof select>): ((e: KeyboardEvent) => void) =>
  api.triggerProps["onKeydown"] as (e: KeyboardEvent) => void;

const press = (key: string): KeyboardEvent =>
  ({ key, preventDefault: () => {} }) as unknown as KeyboardEvent;

test("select commits a value and closes", () => {
  const h = harness(base({ open: true }));
  h.api().select("react");
  expect(h.get().value).toBe("react");
  expect(h.get().open).toBe(false);
});

test("clicking the trigger opens with the selected option active", () => {
  const h = harness(base({ value: "react", active: "react" }));
  (h.api().triggerProps["onClick"] as () => void)();
  expect(h.get().open).toBe(true);
  expect(h.get().active).toBe("react");
});

test("trigger carries the combobox contract", () => {
  const api = select(base({ open: true, active: "react" }), () => {});
  expect(api.triggerProps["role"]).toBe("combobox");
  expect(api.triggerProps["aria-haspopup"]).toBe("listbox");
  expect(api.triggerProps["aria-expanded"]).toBe(true);
  expect(api.triggerProps["aria-controls"]).toBe("fw-listbox");
  expect(api.triggerProps["aria-activedescendant"]).toBe("fw-option-1");
  expect(api.selectedLabel).toBe("Vue");
});

test("arrows move the active highlight (wrapping); Enter commits it", () => {
  const h = harness(base({ open: true, active: "solid" }));
  onKeydown(h.api())(press("ArrowDown")); // wraps solid -> vue
  expect(h.get().active).toBe("vue");
  onKeydown(h.api())(press("ArrowUp")); // wraps vue -> solid
  expect(h.get().active).toBe("solid");
  onKeydown(h.api())(press("Home"));
  expect(h.get().active).toBe("vue");
  onKeydown(h.api())(press("Enter"));
  expect(h.get().value).toBe("vue");
  expect(h.get().open).toBe(false);
});

test("Escape closes without committing", () => {
  const h = harness(base({ open: true, value: "vue", active: "react" }));
  onKeydown(h.api())(press("Escape"));
  expect(h.get().open).toBe(false);
  expect(h.get().value).toBe("vue");
});

test("option props mark selected + active for the theme", () => {
  const api = select(base({ open: true, value: "vue", active: "react" }), () => {});
  expect(api.optionProps(OPTIONS[0]!)["aria-selected"]).toBe(true);
  expect(api.optionProps(OPTIONS[0]!)["data-state"]).toBe("checked");
  expect(api.optionProps(OPTIONS[1]!)["data-active"]).toBe("");
  expect(api.optionProps(OPTIONS[0]!)["id"]).toBe("fw-option-0");
});
