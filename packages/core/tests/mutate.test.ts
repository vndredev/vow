import {
  addEntity,
  addField,
  addForm,
  addView,
  removeField,
  removeVow,
  setNav,
} from "../src/mutate.ts";
import { expect, test } from "vite-plus/test";
import { mkdtempSync, rmSync } from "node:fs";
import { loadVows } from "../src/load.ts";
import path from "node:path";
import { tmpdir } from "node:os";

const freshDir = (): string => mkdtempSync(path.join(tmpdir(), "vow-mut-"));

test("addEntity writes a new entity vow that loads back", () => {
  const dir = freshDir();
  try {
    addEntity(dir, {
      fields: [{ name: "title", required: true, type: "text" }],
      intent: "A task",
      slug: "task",
    });
    const tree = loadVows(dir);
    expect(tree).toHaveLength(1);
    expect(tree[0]?.slug).toBe("task");
    expect(tree[0]?.fields[0]?.name).toBe("title");
    expect(tree[0]?.fulfills).toEqual({ as: "entity", kind: "emit" });
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
});

test("addField + removeField mutate an entity's fields", () => {
  const dir = freshDir();
  try {
    addEntity(dir, {
      fields: [{ name: "title", required: true, type: "text" }],
      intent: "A task",
      slug: "task",
    });
    addField(dir, "task", { name: "done", required: false, type: "boolean" });
    expect(loadVows(dir)[0]?.fields.map((field: { readonly name: string }) => field.name)).toEqual([
      "title",
      "done",
    ]);
    removeField(dir, "task", "title");
    expect(loadVows(dir)[0]?.fields.map((field: { readonly name: string }) => field.name)).toEqual([
      "done",
    ]);
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
});

test("addView writes a view + nav; setNav updates it", () => {
  const dir = freshDir();
  try {
    addView(dir, {
      intent: "The home",
      nav: { label: "Home" },
      slug: "home",
      view: [{ type: "h1", value: "Hi" }],
    });
    expect(loadVows(dir)[0]?.nav?.label).toBe("Home");
    setNav(dir, "home", { icon: "home", label: "Start" });
    expect(loadVows(dir)[0]?.nav).toEqual({ icon: "home", label: "Start" });
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
});

test("setNav patches (omitted keys keep their existing value)", () => {
  const dir = freshDir();
  try {
    addView(dir, {
      intent: "The home",
      nav: { group: "main", icon: "home", label: "Home" },
      slug: "home",
      view: [{ type: "h1", value: "Hi" }],
    });
    setNav(dir, "home", { order: 2 });
    expect(loadVows(dir)[0]?.nav).toEqual({ group: "main", icon: "home", label: "Home", order: 2 });
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
});

test("addForm writes a bound `## form` vow that loads back", () => {
  const dir = freshDir();
  try {
    addEntity(dir, {
      fields: [{ name: "title", required: true, type: "text" }],
      intent: "A task",
      slug: "task",
    });
    addForm(dir, { intent: "Add a task", of: "task", slug: "add-task", submit: "Add task" });
    const form = loadVows(dir).find((vow: { readonly slug: string }) => vow.slug === "add-task");
    expect(form?.fulfills).toEqual({ as: "form", kind: "emit" });
    expect(form?.form).toEqual({ of: "task", submit: "Add task" });
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
});

test("a mutation validates a dangling reference before writing", () => {
  const dir = freshDir();
  try {
    addEntity(dir, {
      fields: [{ name: "title", required: true, type: "text" }],
      intent: "A task",
      slug: "task",
    });
    expect(() => {
      addField(dir, "task", { name: "owner", ref: "ghost", required: false, type: "reference" });
    }).toThrow(/not a known entity/u);
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
});

test("removeVow deletes the file; a referenced entity can't be removed", () => {
  const dir = freshDir();
  try {
    addEntity(dir, {
      fields: [{ name: "name", required: true, type: "text" }],
      intent: "A user",
      slug: "user",
    });
    addEntity(dir, {
      fields: [{ name: "owner", ref: "user", required: false, type: "reference" }],
      intent: "A task",
      slug: "task",
    });
    // `task` references it.
    expect(() => {
      removeVow(dir, "user");
    }).toThrow(/not a known entity/u);
    removeVow(dir, "task");
    // Now unreferenced.
    removeVow(dir, "user");
    expect(loadVows(dir)).toHaveLength(0);
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
});
