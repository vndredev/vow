import { createApp } from "vue";
// Optional default theme (minimal, swappable). Comment this out for fully unstyled output, or swap
// @vow/theme for your own (e.g. the vndre.dev tokens) — same class/data-* hooks, no component change.
import "@vow/theme/vow.css";
// The default list view — generated straight from app/task.vow.md (the entity brings its own view).
// Seed rows go through the entity's own createTask factory — entity + view, end to end.
import Task from "../.generated/Task.vue";
import { createTask } from "../.generated/task.ts";

const items = [
  createTask({ title: "Buy groceries" }),
  createTask({ title: "File taxes", done: true }),
  createTask({ title: "Document vow" }),
];

createApp(Task, { items }).mount("#app");
