import { expect, test } from "vite-plus/test";
import { LAYOUT_PRIMITIVES, emitContainerSfc, layoutSfcs } from "../src/index.ts";

test("Container centers a max-width step from the theme", () => {
  const sfc = emitContainerSfc();
  expect(sfc).toContain(
    "const props = withDefaults(defineProps<{ size?: 1 | 2 | 3 | 4 }>(), { size: 3 });",
  );
  expect(sfc).toContain(
    "`max-width: var(--vow-container-${props.size}); margin-left: auto; margin-right: auto; width: 100%`",
  );
  expect(sfc).toContain('<div class="vow-container" :style="style">');
});

test("layoutSfcs and LAYOUT_PRIMITIVES cover all four primitives in order", () => {
  expect(layoutSfcs().map((s) => s.name)).toEqual(["Flex", "Grid", "Box", "Container"]);
  expect(LAYOUT_PRIMITIVES).toEqual(["Flex", "Grid", "Box", "Container"]);
});
