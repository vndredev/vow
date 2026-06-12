import {
  LAYOUT_ADAPTERS,
  LAYOUT_PRIMITIVES,
  emitContainerSfc,
  emitStackSfc,
  layoutSfcs,
} from "../src/index.ts";
import { expect, test } from "vite-plus/test";

test("Container centers a max-width step from the theme", () => {
  const sfc = emitContainerSfc();
  expect(sfc).toContain(
    "const props = withDefaults(defineProps<{ size?: 1 | 2 | 3 | 4 }>(), { size: 3 });",
  );
  expect(sfc).toContain(
    `\`max-width: var(--vow-container-\${props.size}); margin-left: auto; margin-right: auto; width: 100%\``,
  );
  expect(sfc).toContain('<div class="vow-container" :style="style">');
});

test("Stack is a flex column with a gap (the common page/form arrangement)", () => {
  const sfc = emitStackSfc();
  expect(sfc).toContain("const props = withDefaults(defineProps<{ gap?: number }>(), { gap: 4 });");
  expect(sfc).toContain("'flex-direction: column'");
  expect(sfc).toContain(`props.gap ? \`gap: var(--vow-space-\${props.gap})\` : ''`);
  expect(sfc).toContain('<div class="vow-stack" :style="style">');
});

test("LAYOUT_ADAPTERS is the single source; layoutSfcs and LAYOUT_PRIMITIVES derive from it", () => {
  const names = ["Box", "Container", "Flex", "Grid", "Stack"];
  expect(Object.keys(LAYOUT_ADAPTERS)).toEqual(names);
  expect(layoutSfcs().map((entry) => entry.name)).toEqual(names);
  expect(LAYOUT_PRIMITIVES).toEqual(names);
});
