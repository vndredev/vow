import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { emitCheckboxSfc, emitCollapsibleSfc, emitTabsSfc } from "@vow/emit-primitive";
import { defineConfig } from "vitepress";

const here = dirname(fileURLToPath(import.meta.url));

// Materialise vow's generated primitive adapters as real .vue files the docs import live. The docs
// hand-write no demo component — they render the exact `emit` output, so a page is itself proof the
// generated UI runs (and stays 1:1 with the emitter). Regenerated on every dev start + build.
function vowPrimitives() {
  return {
    name: "vow:primitives",
    buildStart() {
      const out = resolve(here, "theme/generated");
      mkdirSync(out, { recursive: true });
      writeFileSync(resolve(out, "Checkbox.vue"), emitCheckboxSfc());
      writeFileSync(resolve(out, "Collapsible.vue"), emitCollapsibleSfc());
      writeFileSync(resolve(out, "Tabs.vue"), emitTabsSfc());
    },
  };
}

// vow's docs — built with VitePress (the Vue-team SSG, same VoidZero stack), kept in sync from day one.
export default defineConfig({
  title: "vow",
  description: "The spec-driven framework for Vue — your app, as a promise.",
  cleanUrls: true,
  vite: { plugins: [vowPrimitives()] },
  themeConfig: {
    nav: [
      { text: "Guide", link: "/guide/" },
      { text: "Roadmap", link: "/guide/roadmap" },
    ],
    sidebar: {
      "/guide/": [
        {
          text: "Introduction",
          items: [
            { text: "What is vow?", link: "/guide/" },
            { text: "Getting started", link: "/guide/getting-started" },
            { text: "The Vow primitive", link: "/guide/vow" },
            { text: "App structure", link: "/guide/structure" },
          ],
        },
        {
          text: "Fulfilment",
          items: [
            { text: "emit — generated", link: "/guide/emit" },
            { text: "bind — hand-written", link: "/guide/bind" },
            { text: "proof — scenario-coverage", link: "/guide/proof" },
          ],
        },
        {
          text: "UI",
          items: [
            { text: "The component model", link: "/guide/components" },
            {
              text: "Primitives",
              link: "/guide/primitives",
              collapsed: false,
              items: [
                { text: "Checkbox", link: "/guide/primitives/checkbox" },
                { text: "Collapsible", link: "/guide/primitives/collapsible" },
                { text: "Tabs", link: "/guide/primitives/tabs" },
              ],
            },
            { text: "Views", link: "/guide/layout" },
          ],
        },
        {
          text: "Project",
          items: [{ text: "Roadmap", link: "/guide/roadmap" }],
        },
      ],
    },
  },
});
