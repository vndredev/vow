import { createApp, h } from "vue";
// Optional default theme (minimal, swappable). Comment this out for fully unstyled output, or swap
// @vow/theme for your own (e.g. the vndre.dev tokens) — same class/data-* hooks, no component change.
import "@vow/theme/vow.css";
// The app shell is generated from app/shell.vow.md (Container > Flex column) — layout authored in the
// .vow.md. The task list (generated from app/task.vow.md) fills its default slot; a heading the
// `header` slot. Layout from the spec, content wired here — the vow-native layout path, end to end.
import Shell from "../.generated/shell.vue";
import Task from "../.generated/Task.vue";
import { createTask } from "../.generated/task.ts";

const items = [
  createTask({ title: "Buy groceries" }),
  createTask({ title: "File taxes", done: true }),
  createTask({ title: "Document vow" }),
];

createApp({
  render: () =>
    h(Shell, null, {
      header: () => h("h1", { class: "vow-view__title" }, "vow demo"),
      default: () => h(Task, { items }),
    }),
}).mount("#app");
