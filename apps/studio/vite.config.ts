import { defineConfig } from "vite-plus";
import vue from "@vitejs/plugin-vue";
import { vow } from "@vow/vite-plugin";

// The vow studio — the dogfood product, built entirely from vow's own means: a clean vow tree in
// ./app/ generates the dashboard, the work views, and the chrome (@vow/shell). No hand-written src/.
export default defineConfig({
  plugins: [vue(), vow({ title: "vow studio" })],
});
