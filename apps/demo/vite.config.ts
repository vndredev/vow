import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { defineConfig } from "vite-plus";
import vue from "@vitejs/plugin-vue";
import { vow } from "@vow/vite-plugin";

// Source of truth = ./.vow/ (folder-tree of vow.md). vow() generates real .vue into .vow/generated/;
// plugin-vue compiles them. The app is the live projection — the .vue files are never the source.
const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [vue(), vow({ dir: join(root, ".vow") })],
});
