// @vitest-environment node
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { type Vow as VowNode } from "@vow/core";
import { generateFiles } from "../src/index.ts";

/** A `## view`: a list of components; it pulls in the layout primitives it uses. */
const shell: VowNode = {
  id: "vow_shell",
  slug: "shell",
  intent: "App shell",
  children: [],
  fields: [],
  proof: [],
  fulfills: { kind: "emit", as: "view" },
  view: [{ type: "flex", value: { direction: "column", gap: 4, children: [{ text: "hi" }] } }],
};

test("generateFiles renders a `## view` and writes the layout primitives it needs", () => {
  const dir = mkdtempSync(join(tmpdir(), "vow-gen-"));
  try {
    generateFiles([shell], dir, dir);
    const files = readdirSync(dir);
    expect(files).toContain("shell.vue");
    expect(files).toContain("Flex.vue"); // layout primitives written alongside

    const shellVue = readFileSync(join(dir, "shell.vue"), "utf8");
    expect(shellVue).toContain('<div class="vow-app">');
    expect(shellVue).toContain('<Flex :direction="\'column\'" :gap="4">hi</Flex>');
    expect(shellVue).toContain('import Flex from "./Flex.vue";');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

const task: VowNode = {
  id: "vow_task",
  slug: "task",
  intent: "A task",
  children: [],
  fields: [
    { name: "title", type: "text", required: true },
    { name: "done", type: "boolean", required: false },
  ],
  proof: [],
  fulfills: { kind: "emit", as: "entity" },
};

test("a lone entity is a pure model — only its .ts + .test.ts, no view, no primitives", () => {
  const dir = mkdtempSync(join(tmpdir(), "vow-gen-"));
  try {
    generateFiles([task], dir, dir);
    const files = readdirSync(dir);
    expect(files).toContain("task.ts");
    expect(files).toContain("task.test.ts");
    expect(files).not.toContain("Task.vue"); // not auto-rendered — a view must pull it in
    expect(files).not.toContain("Checkbox.vue");
    expect(files).not.toContain("Flex.vue");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a `## view` with `list: task` pulls in the entity's list (+ Checkbox for its boolean)", () => {
  const page: VowNode = {
    id: "vow_page",
    slug: "page",
    intent: "A page",
    children: [],
    fields: [],
    proof: [],
    fulfills: { kind: "emit", as: "view" },
    view: [{ type: "list", value: "task" }],
  };
  const dir = mkdtempSync(join(tmpdir(), "vow-gen-"));
  try {
    generateFiles([page, task], dir, dir);
    const files = readdirSync(dir);
    expect(files).toContain("Task.vue"); // emitted because the view lists it
    expect(files).toContain("Checkbox.vue"); // task has a boolean field
    const pageVue = readFileSync(join(dir, "page.vue"), "utf8");
    expect(pageVue).toContain("<Task />");
    expect(pageVue).toContain('import Task from "./Task.vue";');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a `root` page generates the boot (main.ts) + the env shims", () => {
  const dir = mkdtempSync(join(tmpdir(), "vow-gen-"));
  try {
    generateFiles([{ ...shell, root: true }], dir, dir);
    const files = readdirSync(dir);
    expect(files).toContain("main.ts");
    expect(files).toContain("vow-env.d.ts");
    const main = readFileSync(join(dir, "main.ts"), "utf8");
    expect(main).toContain('import Shell from "./shell.vue";');
    expect(main).toContain('createApp(Shell).mount("#app");');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a non-root view generates no boot", () => {
  const dir = mkdtempSync(join(tmpdir(), "vow-gen-"));
  try {
    generateFiles([shell], dir, dir);
    expect(readdirSync(dir)).not.toContain("main.ts");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
