import { expect, test } from "vite-plus/test";
import { emitCheckboxSfc } from "../src/index.ts";

test("emitCheckboxSfc generates a Vue adapter over the headless core with class + data hooks", () => {
  const sfc = emitCheckboxSfc();
  // uses the agnostic core (logic + a11y live there)
  expect(sfc).toContain('import { checkbox } from "@vow/headless";');
  expect(sfc).toContain(
    "defineProps<{ modelValue: boolean; label: string; disabled?: boolean }>()",
  );
  expect(sfc).toContain('emit("update:modelValue", next.checked)');
  // a <button role=checkbox> control (Reka-style) wrapping an indicator part; spreads the core's props
  expect(sfc).toContain("<button ");
  expect(sfc).toContain('v-bind="api.controlProps"');
  expect(sfc).toContain('v-bind="api.indicatorProps"');
  expect(sfc).toContain('class="vow-checkbox"');
  expect(sfc).toContain('class="vow-checkbox__control"');
  expect(sfc).toContain('class="vow-checkbox__indicator"');
  expect(sfc).toContain(':aria-label="label"');
  // carries no styling of its own — vow's base look lives in @vow/theme (swappable)
  expect(sfc).not.toContain("<style");
});
