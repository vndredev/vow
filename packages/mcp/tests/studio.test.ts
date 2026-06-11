import { expect, test } from "vite-plus/test";
import { idByLabel, labelField, referenceRef } from "../src/studio.ts";
import type { Vow } from "@vow/core";

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
