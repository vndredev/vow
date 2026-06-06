import { defineConfig } from "vitepress";

// vow's docs — built with VitePress (the Vue-team SSG, same VoidZero stack), kept in sync from day one.
export default defineConfig({
  title: "vow",
  description: "The spec-driven framework for Vue — your app, as a promise.",
  cleanUrls: true,
  themeConfig: {
    nav: [{ text: "Guide", link: "/guide/" }],
    sidebar: {
      "/guide/": [
        {
          text: "Introduction",
          items: [
            { text: "What is vow?", link: "/guide/" },
            { text: "The Vow primitive", link: "/guide/vow" },
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
          items: [{ text: "Primitives", link: "/guide/primitives" }],
        },
      ],
    },
  },
});
