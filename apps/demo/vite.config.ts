import { defineConfig } from "vite-plus";
import { vow } from "@vow/vite-plugin";
import type { Vow } from "@vow/core";

/** The single source of truth: a vow tree. The app below is its live projection — no files. */
const tree: Vow = {
  id: "vow_demo",
  slug: "demo-app",
  intent: "The vow demo app",
  proof: [],
  children: [
    {
      id: "vow_card",
      slug: "welcome-card",
      intent: "Welcome to vow — this component was emitted from a vow, live, with no file on disk.",
      children: [],
      proof: [],
      fulfills: { kind: "emit", as: "vue" },
    },
  ],
};

export default defineConfig({
  plugins: [vow({ tree })],
});
