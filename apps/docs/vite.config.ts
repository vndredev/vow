import vue from "@vitejs/plugin-vue";
import { vowDocs } from "@vow/docs";
import { vow } from "@vow/vite-plugin";
import { defineConfig } from "vite-plus";

// The docs are a vow app: ./app/ (vow.md tree) is the truth; vow() generates real .vue into
// ./.generated/. vowDocs() scans the plain .md content in /docs into generated prose pages — the
// content stays as markdown, rendered through the core (@vow/markdown), dogfooded. No hand-written src/.
export default defineConfig({
  plugins: [
    vue(),
    vow(),
    vowDocs({
      content: "../../docs/guide",
      base: "/guide",
      groups: ["Introduction", "Fulfilment", "UI", "Docs", "Project"],
      title: "vow",
      nav: [
        { text: "Guide", link: "/guide" },
        { text: "Roadmap", link: "/guide/roadmap" },
      ],
    }),
  ],
});
