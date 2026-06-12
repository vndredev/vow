import { expect, test } from "vite-plus/test";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { serialize, writeVow } from "../src/serialize.ts";
import { loadVow } from "../src/load.ts";
import { parseVowMd } from "../src/parse.ts";
import path from "node:path";
import { tmpdir } from "node:os";

// Serialize is the exact inverse of parse: re-parsing serialized output yields the same Vow.
const roundtrips = (slug: string, md: string): void => {
  const vow = parseVowMd(slug, md);
  expect(parseVowMd(slug, serialize(vow))).toEqual(vow);
};

test("round-trips an entity — text/select/reference/longtext fields (required) + a seed", () => {
  roundtrips(
    "task",
    [
      "---",
      "id: vow_task",
      "fulfills: emit entity",
      "---",
      "",
      "# A unit of work",
      "",
      "## fields",
      "",
      "- title: text, required",
      "- status: select(todo|doing|done)",
      "- assignee: reference(user)",
      "- notes: longtext",
      "",
      "## seed",
      "",
      "```yaml",
      "- { title: First, status: todo }",
      "```",
      "",
    ].join("\n"),
  );
});

test("round-trips a root view — title + nav + shell + a view with object values", () => {
  roundtrips(
    "home",
    [
      "---",
      "id: vow_home",
      "fulfills: emit view",
      "root: true",
      "title: vow studio",
      "nav: { label: Home, icon: home, group: Plan }",
      "shell: { nav: sidebar-left, width: full, variant: bordered }",
      "---",
      "",
      "# The home",
      "",
      "## view",
      "",
      "```yaml",
      "- h1: Your work",
      "- stats: { of: task, by: status }",
      "- list: task",
      "```",
      "",
    ].join("\n"),
  );
});

test("round-trips a form + proves, and a bind fulfilment", () => {
  roundtrips(
    "addtask",
    [
      "---",
      "id: vow_addtask",
      "fulfills: emit form",
      "---",
      "",
      "# Add a task",
      "",
      "## proves",
      "",
      "- a task can be created",
      "",
      "## form",
      "",
      "```yaml",
      "of: task",
      "submit: Create task",
      "```",
      "",
    ].join("\n"),
  );
  roundtrips(
    "rollup",
    [
      "---",
      "id: vow_rollup",
      "fulfills: bind @vow/core#deriveStatus",
      "---",
      "",
      "# Derive status",
      "",
    ].join("\n"),
  );
});

test("writeVow saves a vow that loadVow reads back identically", () => {
  const vow = parseVowMd(
    "task",
    [
      "---",
      "id: vow_task",
      "fulfills: emit entity",
      "---",
      "",
      "# A task",
      "",
      "## fields",
      "",
      "- title: text, required",
      "",
    ].join("\n"),
  );
  const dir = mkdtempSync(path.join(tmpdir(), "vow-ser-"));
  try {
    writeVow(dir, vow);
    expect(loadVow(dir, "task")).toEqual(vow);
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
});

// The write is atomic (temp-file + renameSync): the watcher never observes a half-written file, and no
// `.tmp` artifact is left behind once the rename completes.
test("writeVow writes atomically — only the final file remains, no .tmp left over", () => {
  const vow = parseVowMd(
    "task",
    ["---", "id: vow_task", "fulfills: emit entity", "---", "", "# A task", ""].join("\n"),
  );
  const dir = mkdtempSync(path.join(tmpdir(), "vow-ser-"));
  try {
    writeVow(dir, vow);
    const entries = readdirSync(dir);
    expect(entries).toEqual(["task.vow.md"]);
    expect(entries.some((name) => name.endsWith(".tmp"))).toBe(false);
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
});
