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
