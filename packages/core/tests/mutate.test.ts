import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { loadVows } from "../src/load.ts";
import { addEntity, addField, addView, removeField, removeVow, setNav } from "../src/mutate.ts";

const freshDir = (): string => mkdtempSync(join(tmpdir(), "vow-mut-"));

test("addEntity writes a new entity vow that loads back", () => {
  const dir = freshDir();
  try {
    addEntity(dir, {
      slug: "task",
      intent: "A task",
      fields: [{ name: "title", type: "text", required: true }],
    });
    const tree = loadVows(dir);
    expect(tree).toHaveLength(1);
    expect(tree[0]?.slug).toBe("task");
    expect(tree[0]?.fields[0]?.name).toBe("title");
    expect(tree[0]?.fulfills).toEqual({ kind: "emit", as: "entity" });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("addField + removeField mutate an entity's fields", () => {
  const dir = freshDir();
  try {
    addEntity(dir, {
      slug: "task",
      intent: "A task",
      fields: [{ name: "title", type: "text", required: true }],
    });
    addField(dir, "task", { name: "done", type: "boolean", required: false });
    expect(loadVows(dir)[0]?.fields.map((f) => f.name)).toEqual(["title", "done"]);
    removeField(dir, "task", "title");
    expect(loadVows(dir)[0]?.fields.map((f) => f.name)).toEqual(["done"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("addView writes a view + nav; setNav updates it", () => {
  const dir = freshDir();
  try {
    addView(dir, {
      slug: "home",
      intent: "The home",
      view: [{ type: "h1", value: "Hi" }],
      nav: { label: "Home" },
    });
    expect(loadVows(dir)[0]?.nav?.label).toBe("Home");
    setNav(dir, "home", { label: "Start", icon: "home" });
    expect(loadVows(dir)[0]?.nav).toEqual({ label: "Start", icon: "home" });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a mutation validates a dangling reference before writing", () => {
  const dir = freshDir();
  try {
    addEntity(dir, {
      slug: "task",
      intent: "A task",
      fields: [{ name: "title", type: "text", required: true }],
    });
    expect(() =>
      addField(dir, "task", { name: "owner", type: "reference", required: false, ref: "ghost" }),
    ).toThrow(/not a known entity/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("removeVow deletes the file; a referenced entity can't be removed", () => {
  const dir = freshDir();
  try {
    addEntity(dir, {
      slug: "user",
      intent: "A user",
      fields: [{ name: "name", type: "text", required: true }],
    });
    addEntity(dir, {
      slug: "task",
      intent: "A task",
      fields: [{ name: "owner", type: "reference", required: false, ref: "user" }],
    });
    expect(() => removeVow(dir, "user")).toThrow(/not a known entity/); // task references it
    removeVow(dir, "task");
    removeVow(dir, "user"); // now unreferenced
    expect(loadVows(dir)).toHaveLength(0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
