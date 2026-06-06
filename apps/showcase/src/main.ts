import { createApp, h } from "vue";
// Optional default theme (minimal, swappable). Comment this out for fully unstyled output, or swap
// @vow/theme for your own (e.g. the vndre.dev tokens) — same class/data-* hooks, no component change.
import "@vow/theme/vow.css";
// The showcase page is generated from app/showcase.vow.md (a ## tree: Container > Flex/Grid of boxes)
// — layout authored in the .vow.md. Its default slot holds the task list (generated from
// app/task.vow.md), so the page shows the layout primitives AND a vow-generated view, end to end.
import Showcase from "../.generated/showcase.vue";
import Task from "../.generated/Task.vue";
import { createTask } from "../.generated/task.ts";

const items = [
  createTask({ title: "Buy groceries" }),
  createTask({ title: "File taxes", done: true }),
  createTask({ title: "Document vow" }),
];

createApp({
  render: () => h(Showcase, null, { default: () => h(Task, { items }) }),
}).mount("#app");
