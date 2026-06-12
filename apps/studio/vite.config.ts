import { defineConfig } from "vite-plus";
import { vow } from "@vow/vite-plugin";
import vue from "@vitejs/plugin-vue";

// The vow studio — the dogfood product, built entirely from vow's own means: a clean vow tree in
// ./app/ generates the dashboard, the work views, and the chrome (@vow/shell). No hand-written src/.
// It opts into the vndre.dev "Papier & Nacht" theme — the additive opt-in over the default vow.css.
export default defineConfig({
  plugins: [vue(), vow({ theme: "@vow/theme/nacht.css" })],
});
