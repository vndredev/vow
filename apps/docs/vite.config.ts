import { defineConfig } from "vite-plus";
import { vow } from "@vow/vite-plugin";
import { vowDocs } from "@vow/docs";
import vue from "@vitejs/plugin-vue";

/*
 * The docs are a vow app: ./app/ (vow.md tree) is the truth; vow() generates real .vue into
 * ./.generated/. vowDocs() scans the plain .md content in /docs into generated prose pages — the
 * content stays as markdown, rendered through the core (@vow/markdown), dogfooded. No hand-written src/.
 */
export default defineConfig({
  plugins: [
    vue(),
    vow(),
    vowDocs({
      base: "/guide",
      content: "../../docs/guide",
      description:
        "A spec-driven, LLM-first generator for Vue — describe your app as vows (promises), and vow generates a type-safe Vue app you own.",
      groups: ["Introduction", "Fulfilment", "UI", "Reference", "Git", "Docs", "Project"],
      nav: [
        { link: "/guide", text: "Guide" },
        { link: "/guide/changelog", text: "Changelog" },
      ],
      title: "vow",
    }),
  ],
});
