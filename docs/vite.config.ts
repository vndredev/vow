import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  emitCheckboxSfc,
  emitCollapsibleSfc,
  emitDialogSfc,
  emitSelectSfc,
  emitTabsSfc,
} from "@vow/emit-primitive";
import { studioDocs } from "@vow/studio";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite-plus";
import config from "./studio.config.ts";

const here = dirname(fileURLToPath(import.meta.url));

// Materialise vow's generated primitive adapters so the demo pages can import + show the real output.
function vowPrimitives() {
  return {
    name: "vow:primitives",
    buildStart() {
      const out = resolve(here, ".studio/generated");
      mkdirSync(out, { recursive: true });
      writeFileSync(resolve(out, "Checkbox.vue"), emitCheckboxSfc());
      writeFileSync(resolve(out, "Collapsible.vue"), emitCollapsibleSfc());
      writeFileSync(resolve(out, "Tabs.vue"), emitTabsSfc());
      writeFileSync(resolve(out, "Dialog.vue"), emitDialogSfc());
      writeFileSync(resolve(out, "Select.vue"), emitSelectSfc());
    },
  };
}

// The docs run on @vow/studio (Vite+), not VitePress. studioDocs (enforce:"pre") turns .md into Vue
// SFCs; vue() then compiles them (hence include: .md).
export default defineConfig({
  plugins: [vowPrimitives(), studioDocs({ config }), vue({ include: [/\.vue$/, /\.md$/] })],
});
