import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { defineConfig } from "vite-plus";
import { vow } from "@vow/vite-plugin";

// The source of truth lives in ./.vow/ (a folder-tree of vow.md). The app is its live projection.
const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [vow({ dir: join(root, ".vow") })],
});
