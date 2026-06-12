import { expect, test } from "vite-plus/test";
import { idByLabel, labelField, openStudio, referenceRef } from "../src/studio.ts";
import { mkdtempSync, rmSync } from "node:fs";
import type { Vow } from "@vow/core";
import path from "node:path";
import { tmpdir } from "node:os";

/** A task entity with a text field + a reference (owner → user) — the assign-by-name shape. */
const task: Vow = {
  children: [],
  fields: [
    { name: "title", required: true, type: "text" },
    { name: "owner", ref: "user", required: false, type: "reference" },
  ],
  fulfills: { as: "entity", kind: "emit" },
  id: "vow_task",
  intent: "A task",
  proof: [],
  slug: "task",
};

test("labelField is the entity's first text field (the display name)", () => {
  expect(labelField(task)).toBe("title");
});

test("referenceRef returns a reference field's target slug, else empty", () => {
  expect(referenceRef(task, "owner")).toBe("user");
  expect(referenceRef(task, "title")).toBe("");
  expect(referenceRef(task, "missing")).toBe("");
});

test("idByLabel resolves a display name to the matching row's id, else empty", () => {
  const rows = [
    { id: "u1", name: "Andre" },
    { id: "u2", name: "Claude" },
  ];
  expect(idByLabel(rows, "name", "Claude")).toBe("u2");
  expect(idByLabel(rows, "name", "Nobody")).toBe("");
});

/** Build a studio over a fresh temp app dir, run `body`, then clean up. */
function withStudio(body: (studio: ReturnType<typeof openStudio>) => void): void {
  const root = mkdtempSync(path.join(tmpdir(), "vow-studio-"));
  const appDir = path.join(root, "app");
  try {
    const studio = openStudio(appDir);
    studio.createEntity({
      fields: [{ name: "name", required: true, type: "text" }],
      intent: "A user",
      slug: "user",
    });
    studio.createEntity({
      fields: [
        { name: "title", required: true, type: "text" },
        { name: "owner", ref: "user", required: false, type: "reference" },
      ],
      intent: "A task",
      slug: "task",
    });
    body(studio);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
}

test("addRecord resolves a reference passed as a display name to the target id", () => {
  withStudio((studio) => {
    const alice = studio.addRecord("user", { name: "Alice" });
    const stored = studio.addRecord("task", { owner: "Alice", title: "Ship it" });
    // The literal name must NOT be stored — it is resolved to Alice's id (no dangling ref).
    expect(stored["owner"]).toBe(alice["id"]);
    expect(stored["owner"]).not.toBe("Alice");
  });
});

test("addRecord and set_record_field resolve a reference name identically", () => {
  withStudio((studio) => {
    const bob = studio.addRecord("user", { name: "Bob" });
    const created = studio.addRecord("task", { title: "Plan" });
    const patched = studio.updateRecord({
      entity: "task",
      field: "owner",
      id: String(created["id"]),
      value: "Bob",
    });
    const viaCreate = studio.addRecord("task", { owner: "Bob", title: "Plan 2" });
    expect(patched?.["owner"]).toBe(bob["id"]);
    expect(viaCreate["owner"]).toBe(bob["id"]);
  });
});

test("addRecord throws on an unknown field rather than silently dropping the typo", () => {
  withStudio((studio) => {
    // A typo of `title` — the db layer copies only known fields, so it would drop the key and return a
    //  Row with an empty title as if the write succeeded; the seam must reject the unknown key instead.
    expect(() => studio.addRecord("task", { titel: "Ship it" })).toThrow(
      /unknown field "titel" on task/u,
    );
  });
});

test("addRecord's unknown-field error lists the entity's known fields", () => {
  withStudio((studio) => {
    expect(() => studio.addRecord("task", { titel: "x" })).toThrow(/known: id, title, owner/u);
  });
});

test("set_record_field throws on an unknown field rather than a silent no-op patch", () => {
  withStudio((studio) => {
    const created = studio.addRecord("task", { title: "Plan" });
    // An unknown column is a no-op UPDATE that still returns the unchanged row as success — reject it.
    expect(() =>
      studio.updateRecord({
        entity: "task",
        field: "titel",
        id: String(created["id"]),
        value: "x",
      }),
    ).toThrow(/unknown field "titel" on task/u);
  });
});

test("addRecord still accepts an explicit id plus declared fields", () => {
  withStudio((studio) => {
    const stored = studio.addRecord("task", { id: "t1", title: "Ship it" });
    expect(stored["id"]).toBe("t1");
    expect(stored["title"]).toBe("Ship it");
  });
});
