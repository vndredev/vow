import vue from "@vitejs/plugin-vue";
import { vow } from "@vow/vite-plugin";
import { defineConfig } from "vite-plus";

// The docs are a vow app: ./app/ (vow.md tree) is the truth; vow() generates real .vue into
// ./.generated/ (hidden, gitignored); plugin-vue compiles them. No hand-written src/ — the doc-system
// itself, dogfooded.
export default defineConfig({
  plugins: [vue(), vow()],
});
