// @vitest-environment node
import { ROUTES_EXPORT, ROUTES_SUFFIX } from "@vow/emit-view";
import { caseCollision, generateFiles } from "../src/index.ts";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { expect, test } from "vite-plus/test";
import type { Vow as VowNode } from "@vow/core";
import path from "node:path";
import { tmpdir } from "node:os";

/** Run `body` against a fresh temp dir, cleaning it up afterwards — keeps each test body small. */
function inTempDir(body: (dir: string) => void): void {
  const dir = mkdtempSync(path.join(tmpdir(), "vow-gen-"));
  try {
    body(dir);
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
}

/** A `## view`: a list of components; it pulls in the layout primitives it uses. */
const shell: VowNode = {
  children: [],
  fields: [],
  fulfills: { as: "view", kind: "emit" },
  id: "vow_shell",
  intent: "App shell",
  proof: [],
  slug: "shell",
  view: [{ type: "flex", value: { children: [{ text: "hi" }], direction: "column", gap: 4 } }],
};

const task: VowNode = {
  children: [],
  fields: [
    { name: "title", required: true, type: "text" },
    { name: "done", required: false, type: "boolean" },
  ],
  fulfills: { as: "entity", kind: "emit" },
  id: "vow_task",
  intent: "A task",
  proof: [],
  slug: "task",
};

test("generateFiles renders a `## view` and writes the layout primitives it needs", () => {
  inTempDir((dir) => {
    generateFiles([shell], { outDir: dir, srcDir: dir });
    const files = readdirSync(dir);
    expect(files).toContain("shell.vue");
    // Layout primitives are written alongside.
    expect(files).toContain("Flex.vue");

    const shellVue = readFileSync(path.join(dir, "shell.vue"), "utf8");
    expect(shellVue).toContain('<div class="vow-app" data-vow-source="shell">');
    expect(shellVue).toContain('<Flex :direction="\'column\'" :gap="4">hi</Flex>');
    expect(shellVue).toContain('import Flex from "./Flex.vue";');
  });
});

test("a `## view` with `loop: { as: status }` materialises the live agent-loop-status component", () => {
  inTempDir((dir) => {
    const cockpit: VowNode = {
      ...shell,
      id: "vow_cockpit",
      slug: "cockpit",
      view: [{ type: "loop", value: { as: "status" } }],
    };
    generateFiles([cockpit], { outDir: dir, srcDir: dir });
    const files = readdirSync(dir);
    // The view references the loop-status component, so the plugin writes it (no dangling import).
    expect(files).toContain("VowAgentLoopStatus.vue");
    expect(readFileSync(path.join(dir, "cockpit.vue"), "utf8")).toContain("<VowAgentLoopStatus");
    const sfc = readFileSync(path.join(dir, "VowAgentLoopStatus.vue"), "utf8");
    expect(sfc).toContain("useAgentLoopStatus");
    // It composes the Badge + Stats/Stat primitives, so the plugin materialises them too (no dangling import).
    expect(files).toContain("Badge.vue");
    expect(files).toContain("Stats.vue");
    expect(files).toContain("Stat.vue");
  });
});

test("a `## view` with `events: { as: trace }` materialises the trace + its Table/Badge primitives", () => {
  inTempDir((dir) => {
    const cockpit: VowNode = {
      ...shell,
      id: "vow_cockpit",
      slug: "cockpit",
      view: [{ type: "events", value: { as: "trace" } }],
    };
    generateFiles([cockpit], { outDir: dir, srcDir: dir });
    const files = readdirSync(dir);
    expect(files).toContain("VowEventTrace.vue");
    expect(readFileSync(path.join(dir, "cockpit.vue"), "utf8")).toContain("<VowEventTrace");
    // The trace composes the Table parts + a Badge per kind, so the plugin writes them (no dangling import).
    expect(files).toContain("Table.vue");
    expect(files).toContain("TableRow.vue");
    expect(files).toContain("TableCell.vue");
    expect(files).toContain("Badge.vue");
  });
});

test("a lone entity is a pure model — only its .ts + .test.ts, no view, no primitives", () => {
  inTempDir((dir) => {
    generateFiles([task], { outDir: dir, srcDir: dir });
    const files = readdirSync(dir);
    expect(files).toContain("task.ts");
    expect(files).toContain("task.test.ts");
    // Not auto-rendered — a view must pull it in.
    expect(files).not.toContain("Task.vue");
    expect(files).not.toContain("Checkbox.vue");
    expect(files).not.toContain("Flex.vue");
  });
});

test("a `## view` with `list: task` pulls in the entity's read-only list (Table parts, no form)", () => {
  const page: VowNode = {
    children: [],
    fields: [],
    fulfills: { as: "view", kind: "emit" },
    id: "vow_page",
    intent: "A page",
    proof: [],
    slug: "page",
    view: [{ type: "list", value: "task" }],
  };
  inTempDir((dir) => {
    generateFiles([page, task], { outDir: dir, srcDir: dir });
    const files = readdirSync(dir);
    // Emitted because the view lists it; the read-only list composes the Table parts.
    expect(files).toContain("Task.vue");
    expect(files).toContain("Table.vue");
    // Read-only: a boolean is Yes/No (not a checkbox), and there is no create form.
    expect(files).not.toContain("Checkbox.vue");
    expect(files).not.toContain("Field.vue");
    const pageVue = readFileSync(path.join(dir, "page.vue"), "utf8");
    expect(pageVue).toContain("<Task />");
    expect(pageVue).toContain('import Task from "./Task.vue";');
  });
});

test("a `list: { of, actions: [delete] }` emits the per-row delete button + the Button adapter", () => {
  const page: VowNode = {
    children: [],
    fields: [],
    fulfills: { as: "view", kind: "emit" },
    id: "vow_page",
    intent: "A page",
    proof: [],
    slug: "page",
    view: [{ type: "list", value: { actions: ["delete"], of: "task" } }],
  };
  inTempDir((dir) => {
    generateFiles([page, task], { outDir: dir, srcDir: dir });
    // The opt-in delete materialises the Button adapter the list now references.
    expect(readdirSync(dir)).toContain("Button.vue");
    const taskVue = readFileSync(path.join(dir, "Task.vue"), "utf8");
    // Wired BY ID (item.id), never the filtered/sorted/grouped loop index.
    expect(taskVue).toContain('@click="removeById(item.id)"');
    expect(taskVue).toContain('icon="trash"');
  });
});

test("a `root` page generates the boot (main.ts) + the env shims", () => {
  inTempDir((dir) => {
    generateFiles([{ ...shell, root: true }], { outDir: dir, srcDir: dir });
    const files = readdirSync(dir);
    expect(files).toContain("main.ts");
    expect(files).toContain("vow-env.d.ts");
    const main = readFileSync(path.join(dir, "main.ts"), "utf8");
    expect(main).toContain('import Shell from "./shell.vue";');
    expect(main).toContain('createRouter(routes, { layout }).mount("#app");');
    expect(main).toContain('{ path: "/", load: async () => ({ default: Shell }) }');
  });
});

test("a non-root view generates no boot", () => {
  inTempDir((dir) => {
    generateFiles([shell], { outDir: dir, srcDir: dir });
    expect(readdirSync(dir)).not.toContain("main.ts");
  });
});

test("a re-generate with identical sources skips the write (unchanged artifacts keep their mtime)", () => {
  inTempDir((dir) => {
    generateFiles([shell], { outDir: dir, srcDir: dir });
    const target = path.join(dir, "shell.vue");
    const before = statSync(target).mtimeMs;
    // Generate again with the exact same vows — the content is identical, so nothing is rewritten.
    generateFiles([shell], { outDir: dir, srcDir: dir });
    expect(statSync(target).mtimeMs).toBe(before);
  });
});

test("a regenerate prunes a vow's orphan when it drops from the plan, sparing a co-owned file", () => {
  const about: VowNode = {
    children: [],
    fields: [],
    fulfills: { as: "view", kind: "emit" },
    id: "vow_about",
    intent: "About",
    proof: [],
    slug: "about",
    view: [{ type: "flex", value: { children: [{ text: "about" }], direction: "column", gap: 4 } }],
  };
  inTempDir((dir) => {
    // First pass: both views are in the plan, so both files exist.
    generateFiles([shell, about], { outDir: dir, srcDir: dir });
    expect(existsSync(path.join(dir, "about.vue"))).toBe(true);
    // A file vow never wrote (a `@vow/docs` co-owner) — it must survive the prune.
    const coOwned = path.join(dir, "doc-intro.vue");
    writeFileSync(coOwned, "<template>co-owned</template>", "utf8");
    // Second pass: the plan no longer emits `about`, so its file is an orphan that must be pruned.
    generateFiles([shell], { outDir: dir, srcDir: dir });
    expect(existsSync(path.join(dir, "about.vue"))).toBe(false);
    // The remaining view stays, and the co-owned file vow never wrote is untouched.
    expect(existsSync(path.join(dir, "shell.vue"))).toBe(true);
    expect(existsSync(coOwned)).toBe(true);
  });
});

test("the routes producer honors the boot glob convention — shared suffix + export name", () => {
  const page: VowNode = {
    children: [],
    fields: [],
    fulfills: { as: "view", kind: "emit" },
    id: "vow_about",
    intent: "About",
    proof: [],
    slug: "about",
    view: [{ type: "flex", value: { children: [{ text: "about" }], direction: "column", gap: 4 } }],
  };
  inTempDir((dir) => {
    // A root view + a non-root page -> the app routes/layout fragments the boot globs.
    generateFiles([{ ...shell, root: true }, page], { outDir: dir, srcDir: dir });
    // The boot globs `*.routes.ts`; the producer's filename must end with the shared suffix.
    const routesFile = readdirSync(dir).find((file) => file.endsWith(ROUTES_SUFFIX));
    expect(routesFile).toBeDefined();
    // And the file must export the shared key the boot reads each fragment by.
    const routes = readFileSync(path.join(dir, routesFile ?? ""), "utf8");
    expect(routes).toContain(`export const ${ROUTES_EXPORT}: Route[] =`);
  });
});

test("caseCollision flags basenames that differ only by case (the slug-vs-primitive trap)", () => {
  expect(caseCollision(["/g/table.vue", "/g/Table.vue"])).toEqual(["table.vue", "Table.vue"]);
  expect(caseCollision(["/g/issues.vue", "/g/Table.vue", "/g/Badge.vue"])).toBeUndefined();
  // An exact repeat is not a case clash.
  expect(caseCollision(["/g/a.ts", "/g/a.ts"])).toBeUndefined();
});
