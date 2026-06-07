import { createApp } from "vue";
// Optional default theme (minimal, swappable). Comment this out for fully unstyled output, or swap
// @vow/theme for your own (e.g. the vndre.dev tokens) — same class/data-* hooks, no component change.
import "@vow/theme/vow.css";
// The whole page is generated from app/landing.vow.md — its `## tree` composes the layout, the text,
// AND the task list (`- Task`). Nothing is wired by hand here: this boot just mounts the page.
import Landing from "../.generated/landing.vue";

createApp(Landing).mount("#app");
