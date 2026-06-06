import { expect, test } from "vite-plus/test";
import { emitCheckboxSfc } from "../src/index.ts";

test("emitCheckboxSfc generates an unstyled Vue adapter with class + data hooks", () => {
  const sfc = emitCheckboxSfc();
  // uses the agnostic core (logic + a11y live there)
  expect(sfc).toContain('import { checkbox } from "@vow/headless";');
  expect(sfc).toContain(
    "defineProps<{ modelValue: boolean; label: string; disabled?: boolean }>()",
  );
  expect(sfc).toContain('emit("update:modelValue", next.checked)');
  // spreads the core's part-props + class hooks; no logic, no styling of its own
  expect(sfc).toContain('v-bind="api.controlProps"');
  expect(sfc).toContain('class="vow-checkbox"');
  expect(sfc).toContain('class="vow-checkbox__box"');
  expect(sfc).toContain(':aria-label="label"');
  expect(sfc).not.toContain("<style"); // unstyled — styling lives in @vow/theme
});
