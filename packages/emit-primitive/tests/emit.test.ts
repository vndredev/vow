import { expect, test } from "vite-plus/test";
import { emitCheckboxSfc } from "../src/index.ts";

test("emitCheckboxSfc generates a Vue adapter that forwards the headless checkbox", () => {
  const sfc = emitCheckboxSfc();
  // it uses the agnostic core (the logic + a11y live there)
  expect(sfc).toContain('import { checkbox } from "@vow/headless";');
  // a v-model'd, labelled checkbox
  expect(sfc).toContain(
    "defineProps<{ modelValue: boolean; label: string; disabled?: boolean }>()",
  );
  expect(sfc).toContain('emit("update:modelValue", next.checked)');
  // it just spreads the core's part-props — no logic of its own
  expect(sfc).toContain('v-bind="api.controlProps"');
  expect(sfc).toContain('v-bind="api.rootProps"');
  expect(sfc).toContain(':aria-label="label"');
});
