import { expect, test } from "vite-plus/test";
import { emitBoxSfc } from "../src/index.ts";

test("Box renders withDefaults for p only (width/height stay optional, no default)", () => {
  expect(emitBoxSfc()).toContain(
    "const props = withDefaults(defineProps<{ p?: number; width?: string; height?: string }>(), { p: 0 });",
  );
});

test("Box maps padding to a spacing token and passes width/height through", () => {
  const sfc = emitBoxSfc();
  expect(sfc).toContain(`props.p ? \`padding: var(--vow-space-\${props.p})\` : ''`);
  expect(sfc).toContain(`props.width ? \`width: \${props.width}\` : ''`);
  expect(sfc).toContain('<div class="vow-box" :style="style">');
});
