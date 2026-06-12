// oxlint-disable-next-line consistent-type-specifier-style -- one import; separate trips no-duplicate-imports
import { NONE, type Vow } from "@vow/core";
import { expect, test } from "vite-plus/test";
import { idByLabel, labelField, openStudio, referenceRef } from "../src/studio.ts";
import { mkdtempSync, rmSync } from "node:fs";
import type { FieldPatch } from "../src/types.ts";
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
    studio.addEntity({
      fields: [{ name: "name", required: true, type: "text" }],
      intent: "A user",
      slug: "user",
    });
    studio.addEntity({
      fields: [
        { name: "title", required: true, type: "text" },
        { name: "owner", ref: "user", required: false, type: "reference" },
        { name: "status", options: ["todo", "done"], required: false, type: "select" },
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
    const patched = studio.setRecordField({
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
    // A stray key alongside the valid title must be rejected, not silently dropped.
    // The db layer copies only known fields, so the write would otherwise look like a success.
    expect(() => studio.addRecord("task", { extra: "oops", title: "Ship it" })).toThrow(
      /unknown field "extra" on task/u,
    );
  });
});

test("addRecord's unknown-field error lists the entity's known fields", () => {
  withStudio((studio) => {
    expect(() => studio.addRecord("task", { extra: "x", title: "Ship it" })).toThrow(
      /known: id, title, owner, status/u,
    );
  });
});

test("set_record_field throws on an unknown field rather than a silent no-op patch", () => {
  withStudio((studio) => {
    const created = studio.addRecord("task", { title: "Plan" });
    // An unknown column is a no-op UPDATE that still returns the unchanged row as success — reject it.
    expect(() =>
      studio.setRecordField({
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

test("addRecord rejects an explicit id that is already taken, with an actionable message", () => {
  withStudio((studio) => {
    studio.addRecord("task", { id: "t1", title: "Ship it" });
    // A re-run with the same id (the LLM re-issuing a call it thought failed) must throw an actionable
    // Recovery, not SQLite's opaque "UNIQUE constraint failed".
    expect(() => studio.addRecord("task", { id: "t1", title: "Again" })).toThrow(
      /a task with id "t1" already exists — use set_record_field to update it, or omit id/u,
    );
  });
});

test("addRecord still mints a fresh id when none is supplied (the duplicate guard is id-only)", () => {
  withStudio((studio) => {
    const first = studio.addRecord("task", { title: "Ship it" });
    const second = studio.addRecord("task", { title: "Ship it" });
    expect(first["id"]).not.toBe(second["id"]);
  });
});

test("entityOf's error lists the known entity slugs (the hottest MCP path never dead-ends)", () => {
  withStudio((studio) => {
    // A slug typo hits every data tool — the message must list the live entities to recover from.
    expect(() => studio.listRecords("tsk")).toThrow(/no entity "tsk" — known: task, user/u);
  });
});

/** A `set_field` patch that only renames — the other keys are absent (an unchanged field aspect). */
function renameTo(name: string): FieldPatch {
  return { name, options: NONE, ref: NONE, required: NONE, type: NONE };
}

test("setField rename onto an orphaned column throws BEFORE the vow .md is rewritten", () => {
  withStudio((studio) => {
    // Remove_field is additive at the DB layer — dropping `status` from the vow orphans its column.
    studio.removeField("task", "status");
    // Renaming `title` onto the orphaned `status` column must throw an actionable error, and the vow
    // Must stay untouched (no divergence: the field is still `title`, never silently rewritten).
    expect(() => {
      studio.setField("task", "title", renameTo("status"));
    }).toThrow(
      /cannot rename field to "status": an orphaned column "status" still exists — remove it first/u,
    );
    const task2 = studio.getVow("task");
    expect(task2?.fields.map((field) => field.name)).toContain("title");
    expect(task2?.fields.some((field) => field.name === "status")).toBe(false);
  });
});

test("setField rename to a free column still carries the stored data across", () => {
  withStudio((studio) => {
    const stored = studio.addRecord("task", { title: "Carry me" });
    studio.setField("task", "title", renameTo("label"));
    const got = studio.getRecord("task", String(stored["id"]));
    expect(got?.["label"]).toBe("Carry me");
  });
});

test("addRecord rejects a record missing a required field rather than defaulting it", () => {
  withStudio((studio) => {
    // `title` is required — omitting it must throw, not store a silently defaulted empty title.
    expect(() => studio.addRecord("task", { status: "todo" })).toThrow(
      /required field "title" is missing on task/u,
    );
  });
});

test("addRecord rejects a required field set to the empty string", () => {
  withStudio((studio) => {
    // An explicit empty string is as absent as omission — the running app's zod factory rejects it.
    expect(() => studio.addRecord("task", { title: "" })).toThrow(
      /required field "title" is missing on task/u,
    );
  });
});

test("addRecord rejects a select value outside the field's options, listing the allowed set", () => {
  withStudio((studio) => {
    expect(() => studio.addRecord("task", { status: "blocked", title: "Ship it" })).toThrow(
      /"blocked" is not an option of task.status — allowed: todo, done/u,
    );
  });
});

test("addRecord accepts a select value that is one of the field's options", () => {
  withStudio((studio) => {
    const stored = studio.addRecord("task", { status: "done", title: "Ship it" });
    expect(stored["status"]).toBe("done");
  });
});

test("set_record_field rejects a select value outside the field's options", () => {
  withStudio((studio) => {
    const created = studio.addRecord("task", { title: "Plan" });
    expect(() =>
      studio.setRecordField({
        entity: "task",
        field: "status",
        id: String(created["id"]),
        value: "blocked",
      }),
    ).toThrow(/"blocked" is not an option of task.status — allowed: todo, done/u);
  });
});

/** A `set_field` patch that only retypes — the other keys are absent. */
function retypeTo(type: FieldPatch["type"]): FieldPatch {
  return { name: NONE, options: NONE, ref: NONE, required: NONE, type };
}

/** A `set_field` patch that only edits the options. */
function optionsTo(options: readonly string[]): FieldPatch {
  return { name: NONE, options, ref: NONE, required: NONE, type: NONE };
}

test("add_field of a removed field's name throws on the orphaned column, not a silent resurrection", () => {
  withStudio((studio) => {
    const stored = studio.addRecord("task", { status: "done", title: "Ship it" });
    // Remove `status` — additive at the DB layer, so its column (with the stored "done") is orphaned.
    studio.removeField("task", "status");
    // Re-adding a field of the same name must throw, not adopt the orphan's dead data.
    expect(() => {
      studio.addField("task", {
        name: "status",
        options: ["a", "b"],
        required: false,
        type: "select",
      });
    }).toThrow(
      /cannot add field "status": an orphaned column "status" still exists — remove it first/u,
    );
    // The vow is untouched — the field was not added.
    expect(studio.getVow("task")?.fields.some((field) => field.name === "status")).toBe(false);
    // The original record is intact (nothing corrupted).
    expect(studio.getRecord("task", String(stored["id"]))?.["title"]).toBe("Ship it");
  });
});

test("set_field retype rebuilds the column so a text 'false' re-decodes as a real boolean false", () => {
  withStudio((studio) => {
    // Add a free-text field, store the literal "false" — the value a naive boolean retype mis-reads as true.
    studio.addField("task", { name: "flag", required: false, type: "text" });
    const stored = studio.addRecord("task", { flag: "false", title: "Ship it" });
    studio.setField("task", "flag", retypeTo("boolean"));
    // The column was rebuilt to INTEGER, so the stored row reads back a real false (not true).
    expect(studio.getRecord("task", String(stored["id"]))?.["flag"]).toBe(false);
    // A future false write also round-trips false (no stale TEXT affinity).
    const next = studio.addRecord("task", { flag: false, title: "Next" });
    expect(studio.getRecord("task", String(next["id"]))?.["flag"]).toBe(false);
  });
});

test("set_field options shrink that strands a stored value throws before the vow .md is rewritten", () => {
  withStudio((studio) => {
    studio.addRecord("task", { status: "done", title: "Ship it" });
    // Shrinking the options to drop "done" strands the stored row — the guard rejects it.
    expect(() => {
      studio.setField("task", "status", optionsTo(["todo"]));
    }).toThrow(/cannot shrink options of "status": stored done — allowed: todo/u);
    // The vow kept both options (no divergence: the shrink never landed).
    const field = studio.getVow("task")?.fields.find((candidate) => candidate.name === "status");
    expect(field?.options).toEqual(["todo", "done"]);
  });
});

test("set_field retype away from select is allowed even with stored values (the column becomes free text)", () => {
  withStudio((studio) => {
    studio.addRecord("task", { status: "done", title: "Ship it" });
    // A retype to text drops the options — the values-covered guard must NOT fire (the column is free now).
    expect(() => {
      studio.setField("task", "status", retypeTo("text"));
    }).not.toThrow();
    expect(studio.getVow("task")?.fields.find((field) => field.name === "status")?.type).toBe(
      "text",
    );
  });
});

test("remove_vow then re-create the same entity slug refuses while the orphaned table holds rows", () => {
  withStudio((studio) => {
    studio.addRecord("task", { title: "Dead row" });
    // Dropping the vow archives the table (recoverable) rather than leaving a live orphan...
    studio.removeVow("task");
    // ...but a manual orphan (no archive) would block a re-create; here the archive freed the slug, so a
    // Re-create succeeds and starts FRESH (the dead row does not resurrect under the new entity).
    studio.addEntity({
      fields: [{ name: "title", required: true, type: "text" }],
      intent: "A task again",
      slug: "task",
    });
    expect(studio.listRecords("task")).toHaveLength(0);
  });
});

test("removeRecord refuses to delete a row another entity still references (no dangling ref)", () => {
  withStudio((studio) => {
    const alice = studio.addRecord("user", { name: "Alice" });
    studio.addRecord("task", { owner: "Alice", title: "Ship it" });
    // Deleting Alice while a task's `owner` points at her would strand the reference — refuse it, the
    // Data-layer mirror of remove_vow's reference guard. The message names the referring column.
    expect(() => studio.removeRecord("user", String(alice["id"]))).toThrow(
      /cannot delete user "[^"]+": still referenced by task\.owner \(1 row\)/u,
    );
    // Alice is still there — the refused delete changed nothing.
    expect(studio.getRecord("user", String(alice["id"]))?.["name"]).toBe("Alice");
  });
});

test("removeRecord deletes once the referrer is repointed away", () => {
  withStudio((studio) => {
    const alice = studio.addRecord("user", { name: "Alice" });
    const bob = studio.addRecord("user", { name: "Bob" });
    const ship = studio.addRecord("task", { owner: "Alice", title: "Ship it" });
    // Repoint the only referrer to Bob — Alice is now free to delete.
    studio.setRecordField({ entity: "task", field: "owner", id: String(ship["id"]), value: "Bob" });
    expect(studio.removeRecord("user", String(alice["id"]))).toBe(true);
    expect(studio.getRecord("user", String(alice["id"]))).toBe(NONE);
    // Bob is still referenced — deleting him is still refused.
    expect(() => studio.removeRecord("user", String(bob["id"]))).toThrow(/still referenced by/u);
  });
});

test("setSeed reports true on a fresh entity and false once already seeded (no silent no-op)", () => {
  withStudio((studio) => {
    // `task` has no seed yet and an empty table — the first set_seed applies its rows.
    expect(studio.setSeed("task", [{ status: "done", title: "Seeded" }])).toBe(true);
    expect(studio.listRecords("task")).toHaveLength(1);
    // A second set_seed on the now-seeded entity is a once-ever no-op — it reports false.
    expect(studio.setSeed("task", [{ status: "todo", title: "Other" }])).toBe(false);
    expect(studio.listRecords("task")).toHaveLength(1);
  });
});
