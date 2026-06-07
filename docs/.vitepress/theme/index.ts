import DefaultTheme from "vitepress/theme";
import { h } from "vue";
import type { Theme } from "vitepress";
import FrameworkBlock from "./FrameworkBlock.vue";
import FrameworkSwitcher from "./FrameworkSwitcher.vue";
// vow's primitives are headless (Reka-style) but ship with vow's own base look: the same vow.css that
// dresses generated apps, here dressing the live primitive demos. Swap this import to re-skin at once.
import "@vow/theme/vow.css";

// vow targets many frameworks from one spec (Vue today; React/Solid planned). A header switcher picks
// the target; FrameworkBlock shows framework-specific output (and an honest roadmap banner for the
// planned ones). The switcher is HOSTED in the content slot (never inside the title's home <a>, where
// it would hijack clicks to "/"), and Teleports itself next to the "vow" title on the client.
export default {
  extends: DefaultTheme,
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      "nav-bar-content-before": () => h(FrameworkSwitcher),
    }),
  enhanceApp({ app }) {
    app.component("FrameworkBlock", FrameworkBlock);
  },
} satisfies Theme;
