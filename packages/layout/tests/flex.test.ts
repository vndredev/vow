import { emitFlexSfc, layoutSfcs } from "../src/index.ts";
import { expect, test } from "vite-plus/test";

test("Flex renders defineProps via withDefaults with the documented defaults", () => {
  expect(emitFlexSfc()).toContain(
    "const props = withDefaults(defineProps<{ direction?: 'row' | 'column' | 'row-reverse' | 'column-reverse'; align?: 'start' | 'center' | 'end' | 'baseline' | 'stretch'; justify?: 'start' | 'center' | 'end' | 'between'; wrap?: 'nowrap' | 'wrap' | 'wrap-reverse'; gap?: number }>(), { direction: 'row', align: 'stretch', justify: 'start', wrap: 'nowrap', gap: 0 });",
  );
});

test("Flex is a div with the vow-flex class, a bound style, and a default slot", () => {
  const sfc = emitFlexSfc();
  expect(sfc).toContain('<div class="vow-flex" :style="style">');
  expect(sfc).toContain("    <slot />");
  expect(sfc).toContain("  </div>");
});

test("Flex translates start/end/between edges and maps gap to a theme spacing token", () => {
  const sfc = emitFlexSfc();
  expect(sfc).toContain(
    "v === 'start' ? 'flex-start' : v === 'end' ? 'flex-end' : v === 'between' ? 'space-between' : v;",
  );
  expect(sfc).toContain(`props.gap ? \`gap: var(--vow-space-\${props.gap})\` : ''`);
});

test("layoutSfcs exposes Flex by its component name (the plugin writes these into .generated/)", () => {
  expect(layoutSfcs().map((entry) => entry.name)).toContain("Flex");
});
