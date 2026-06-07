import { createApp, h } from "vue";
// Optional default theme (minimal, swappable). Comment this out for fully unstyled output, or swap
// @vow/theme for your own (e.g. the vndre.dev tokens) — same class/data-* hooks, no component change.
import "@vow/theme/vow.css";
// Both generated from .vow.md: a docs-style landing (app/landing.vow.md — a ## tree hero + feature
// grid) and a CRUD list (app/task.vow.md — an entity). Mounted as siblings: the landing on top, a
// live generated view below. No hand-written .vue.
import Landing from "../.generated/landing.vue";
import Task from "../.generated/Task.vue";
import { createTask } from "../.generated/task.ts";

const items = [
  createTask({ title: "Buy groceries" }),
  createTask({ title: "File taxes", done: true }),
  createTask({ title: "Document vow" }),
];

createApp({
  render: () => h("div", [h(Landing), h(Task, { items })]),
}).mount("#app");
