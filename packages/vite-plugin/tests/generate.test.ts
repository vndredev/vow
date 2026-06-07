// @vitest-environment node
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { type Vow as VowNode } from "@vow/core";
import { generateFiles } from "../src/index.ts";

/** A layout-only view: its `## tree` is the component, and it pulls in the layout primitives. */
const shell: VowNode = {
  id: "vow_shell",
  slug: "shell",
  intent: "App shell",
  children: [],
  fields: [],
  proof: [],
  fulfills: { kind: "emit", as: "view" },
  tree: {
    component: "Container",
    props: { size: "3" },
    children: [
      {
        component: "Flex",
        props: { direction: "column", gap: "4" },
        children: [{ component: "slot", props: {}, children: [] }],
      },
    ],
  },
};

test("generateFiles renders a `## tree` view and writes the layout primitives it needs", () => {
  const dir = mkdtempSync(join(tmpdir(), "vow-gen-"));
  try {
    generateFiles([shell], dir, dir);
    const files = readdirSync(dir);
    expect(files).toContain("shell.vue");
    expect(files).toContain("Container.vue"); // layout primitives written alongside
    expect(files).toContain("Flex.vue");

    const shellVue = readFileSync(join(dir, "shell.vue"), "utf8");
    expect(shellVue).toContain('<Container :size="3">');
    expect(shellVue).toContain('import Container from "./Container.vue";');
    expect(shellVue).toContain("<slot />");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a plain entity view writes no layout primitives (they are pulled in only by a tree)", () => {
  const entity: VowNode = {
    id: "vow_task",
    slug: "task",
    intent: "A task",
    children: [],
    fields: [{ name: "title", type: "text", required: true }],
    proof: [],
    fulfills: { kind: "emit", as: "entity" },
  };
  const dir = mkdtempSync(join(tmpdir(), "vow-gen-"));
  try {
    generateFiles([entity], dir, dir);
    const files = readdirSync(dir);
    expect(files).toContain("Task.vue");
    expect(files).not.toContain("Flex.vue");
    expect(files).not.toContain("Container.vue");
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
