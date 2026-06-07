import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite-plus";

// @vow/studio's own Vite config. For now it only wires plugin-vue so vitest can compile the SFC the
// SSR spike renders. The full studio plugin (markdown -> Vue, virtual routes, the SSG build) arrives
// in later phases — see the plan.
export default defineConfig({
  plugins: [vue()],
});
