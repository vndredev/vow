import { defineConfig } from "vitepress";

// vow's docs — built with VitePress (the Vue-team SSG, same VoidZero stack), kept in sync from day one.
export default defineConfig({
  title: "vow",
  description: "The spec-driven framework for Vue — your app, as a promise.",
  cleanUrls: true,
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
            { text: "Primitives", link: "/guide/primitives" },
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
