import { expect, test } from "vite-plus/test";
import { emitGridSfc } from "../src/index.ts";

test("Grid renders defineProps via withDefaults with the documented defaults", () => {
  expect(emitGridSfc()).toContain(
    "const props = withDefaults(defineProps<{ columns?: number | string; align?: 'start' | 'center' | 'end' | 'baseline' | 'stretch'; justify?: 'start' | 'center' | 'end' | 'between'; gap?: number }>(), { columns: 1, align: 'stretch', justify: 'start', gap: 0 });",
  );
});

test("Grid is a div with the vow-grid class, a bound style, and a default slot", () => {
  const sfc = emitGridSfc();
  expect(sfc).toContain('<div class="vow-grid" :style="style">');
  expect(sfc).toContain("    <slot />");
});

test("Grid turns a column count into equal minmax tracks (a string passes through)", () => {
  expect(emitGridSfc()).toContain(`typeof c === 'number' ? \`repeat(\${c}, minmax(0, 1fr))\` : c;`);
});
