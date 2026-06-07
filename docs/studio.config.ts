import { defineStudio } from "@vow/studio";

// vow's docs config — title, top nav, and the order of sidebar groups (pages join a group via their
// `group` frontmatter). Replaces the old VitePress themeConfig.
export default defineStudio({
  title: "vow",
  description: "The spec-driven framework for Vue — your app, as a promise.",
  nav: [
    { text: "Guide", link: "/guide/" },
    { text: "Roadmap", link: "/guide/roadmap" },
  ],
  sidebarGroups: ["Introduction", "Fulfilment", "UI", "Project"],
});
