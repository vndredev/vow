import { defineConfig } from "vite-plus";
import vue from "@vitejs/plugin-vue";
import { vow } from "@vow/vite-plugin";

// Source of truth = ./app/ (visible folder-tree of vow.md — "your app, as MDs"). vow() generates
// real .vue into ./.generated/ (hidden, gitignored); plugin-vue compiles them. The app is the live
// projection — the generated .vue are inspectable but never the source.
export default defineConfig({
  plugins: [vue(), vow()],
});
