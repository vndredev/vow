import { createApp } from "vue";
// The Tasks view — generated from app/tasks.vow.md (emit view of `task`) into .generated/tasks.vue.
// Seed rows go through the entity's own createTask factory — entity + view, end to end.
import Tasks from "../.generated/tasks.vue";
import { createTask } from "../.generated/task.ts";

const items = [
  createTask({ title: "Einkaufen gehen" }),
  createTask({ title: "Steuer erledigen", done: true }),
  createTask({ title: "vow dokumentieren" }),
];

createApp(Tasks, { items }).mount("#app");
