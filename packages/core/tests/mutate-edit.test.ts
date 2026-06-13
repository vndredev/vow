import { addEntity, addForm, addView, setField, setForm, setSeed, setView } from "../src/mutate.ts";
import { expect, test } from "vite-plus/test";
import { mkdtempSync, rmSync } from "node:fs";
import { loadVows } from "../src/load.ts";
import path from "node:path";
import { tmpdir } from "node:os";

/*
 * The in-place edit half of the authoring API — the mutators that complete the LLM author surface so a
 * page/form/field/seed can be evolved (not delete-and-recreated): `addView`'s root/title/shell, `addForm`'s
 * `edit`, and the `setView`/`setForm`/`setSeed`/`setField` patchers. The DB-column follow on a field rename
 * is proven a layer up (the MCP studio + `@vow/db`); here we pin the vow-tree rewrite.
 */

const freshDir = (): string => mkdtempSync(path.join(tmpdir(), "vow-mut-edit-"));

test("addView threads root, title, and shell onto the written vow", () => {
  const dir = freshDir();
  try {
    addView(dir, {
      intent: "The home",
      root: true,
      shell: { nav: "sidebar-left", variant: "bordered", width: "center" },
      slug: "home",
      title: "My App",
      view: [{ type: "h1", value: "Hi" }],
    });
    const [home] = loadVows(dir);
    expect(home?.root).toBe(true);
    expect(home?.title).toBe("My App");
    expect(home?.shell).toEqual({ nav: "sidebar-left", variant: "bordered", width: "center" });
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
});

test("addForm writes edit: true (the singleton-editor form)", () => {
  const dir = freshDir();
  try {
    addEntity(dir, {
      fields: [{ name: "name", required: true, type: "text" }],
      intent: "Settings",
      slug: "settings",
    });
    addForm(dir, {
      edit: true,
      intent: "Edit settings",
      of: "settings",
      slug: "edit-settings",
      submit: "Save",
    });
    const form = loadVows(dir).find(
      (vow: { readonly slug: string }) => vow.slug === "edit-settings",
    );
    expect(form?.form).toEqual({ edit: true, of: "settings", submit: "Save" });
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
});

test("setForm patches of/submit/edit in place (omitted keys keep their value)", () => {
  const dir = freshDir();
  try {
    addEntity(dir, {
      fields: [{ name: "title", required: true, type: "text" }],
      intent: "A task",
      slug: "task",
    });
    addForm(dir, { intent: "Add a task", of: "task", slug: "add-task", submit: "Add" });
    setForm(dir, "add-task", { edit: true, submit: "Save" });
    const form = loadVows(dir).find((vow: { readonly slug: string }) => vow.slug === "add-task");
    expect(form?.form).toEqual({ edit: true, of: "task", submit: "Save" });
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
});

test("setForm rejects a non-form target (an inert form block) and still patches a real form", () => {
  const dir = freshDir();
  try {
    addEntity(dir, {
      fields: [{ name: "title", required: true, type: "text" }],
      intent: "A task",
      slug: "task",
    });
    addForm(dir, { intent: "Add a task", of: "task", slug: "add-task", submit: "Add" });
    addView(dir, { intent: "The home", slug: "home", view: [{ type: "h1", value: "Hi" }] });
    // A view/entity slug is not a form: editing one merges an inert `form` block, so it must throw.
    expect(() => {
      setForm(dir, "home", { submit: "Save" });
    }).toThrow(/set_form: "home" is not a form/u);
    // A real form still patches.
    setForm(dir, "add-task", { submit: "Save" });
    const form = loadVows(dir).find((vow: { readonly slug: string }) => vow.slug === "add-task");
    expect(form?.form).toEqual({ of: "task", submit: "Save" });
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
});

test("setView replaces a vow's view in place", () => {
  const dir = freshDir();
  try {
    addView(dir, { intent: "The home", slug: "home", view: [{ type: "h1", value: "Old" }] });
    setView(dir, "home", [
      { type: "h1", value: "New" },
      { type: "p", value: "Body" },
    ]);
    const [home] = loadVows(dir);
    expect(home?.view).toEqual([
      { type: "h1", value: "New" },
      { type: "p", value: "Body" },
    ]);
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
});

test("setSeed writes versioned seed records onto an entity, and rejects a non-entity", () => {
  const dir = freshDir();
  try {
    addEntity(dir, {
      fields: [{ name: "title", required: true, type: "text" }],
      intent: "A task",
      slug: "task",
    });
    setSeed(dir, "task", [{ title: "Seed A" }, { title: "Seed B" }]);
    expect(loadVows(dir)[0]?.seed).toEqual([{ title: "Seed A" }, { title: "Seed B" }]);
    addView(dir, { intent: "The home", slug: "home", view: [{ type: "h1", value: "Hi" }] });
    expect(() => {
      setSeed(dir, "home", [{ any: "thing" }]);
    }).toThrow(/set_seed: "home" is not an entity/u);
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
});

test("setField renames a field, retypes it, toggles required, and edits options", () => {
  const dir = freshDir();
  try {
    addEntity(dir, {
      fields: [
        { name: "title", required: true, type: "text" },
        { name: "status", options: ["todo", "done"], required: false, type: "select" },
      ],
      intent: "A task",
      slug: "task",
    });
    // Rename + flip required.
    setField(dir, "task", "title", { name: "name", required: false });
    // Edit a select's options in place.
    setField(dir, "task", "status", { options: ["todo", "doing", "done"] });
    const fields = loadVows(dir)[0]?.fields ?? [];
    expect(fields[0]).toEqual({ name: "name", required: false, type: "text" });
    expect(fields[1]).toEqual({
      name: "status",
      options: ["todo", "doing", "done"],
      required: false,
      type: "select",
    });
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
});

test("setField drops stranded options when a select is retyped away", () => {
  const dir = freshDir();
  try {
    addEntity(dir, {
      fields: [{ name: "status", options: ["todo", "done"], required: false, type: "select" }],
      intent: "A task",
      slug: "task",
    });
    setField(dir, "task", "status", { type: "text" });
    expect(loadVows(dir)[0]?.fields[0]).toEqual({ name: "status", required: false, type: "text" });
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
});

test("setField rejects a rename that collides with another field, and a non-entity target", () => {
  const dir = freshDir();
  try {
    addEntity(dir, {
      fields: [
        { name: "title", required: true, type: "text" },
        { name: "done", required: false, type: "boolean" },
      ],
      intent: "A task",
      slug: "task",
    });
    expect(() => {
      setField(dir, "task", "title", { name: "done" });
    }).toThrow(/set_field: "task" already has a field "done"/u);
    addView(dir, { intent: "The home", slug: "home", view: [{ type: "h1", value: "Hi" }] });
    expect(() => {
      setField(dir, "home", "ghost", { name: "phantom" });
    }).toThrow(/set_field: "home" is not an entity/u);
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
});
