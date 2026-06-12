// @vitest-environment node
import {
  adapterKinds,
  checkVowExample,
  coreFieldTypes,
  germanMarkers,
  germanWords,
  safeReaddir,
  undocumentedFieldTypes,
  undocumentedKinds,
  vowExamplesIn,
} from "../src/index.ts";
import { expect, test } from "vite-plus/test";
import { readFileSync, statSync } from "node:fs";
import { defined } from "@vow/core";
import path from "node:path";

// From packages/gate/tests up to the repo root.
const root = path.join(import.meta.dirname, "..", "..", "..");

/** A skipped directory entry — `node_modules` or any dotfolder. */
function isSkipped(name: string): boolean {
  return name === "node_modules" || name.startsWith(".");
}

/**
 * Recursively collect files under `dir` that `keep` accepts, descending into real subdirectories and
 * skipping node_modules + dotfolders. A missing dir scans nothing. The shared walker keeps both the
 * `.md`-only and the source-file scans to a single, brace-clean traversal.
 */
function filesUnder(dir: string, keep: (name: string) => boolean): string[] {
  const out: string[] = [];
  const walk = (directory: string): void => {
    const live = safeReaddir(directory).filter((name) => !isSkipped(name));
    for (const name of live) {
      const child = path.join(directory, name);
      if (statSync(child).isDirectory()) {
        walk(child);
      } else if (keep(name)) {
        out.push(child);
      }
    }
  };
  walk(dir);
  return out;
}

/** Every `*.md` under a dir, recursively — skipping node_modules and dotfolders. */
function mdFilesUnder(dir: string): string[] {
  return filesUnder(dir, (name) => name.endsWith(".md"));
}

/** A `.ts`/`.md`/`.vue` source file name. */
const SOURCE_FILE = /\.(?:ts|md|vue)$/u;

/** Every `.ts`/`.md`/`.vue` under a dir, recursively — skipping node_modules, dotfolders, dist. */
function sourceFilesUnder(dir: string): string[] {
  return filesUnder(dir, (name) => name !== "dist" && SOURCE_FILE.test(name));
}

test("every vow.md example in the docs/README parses against the real core (no drift)", () => {
  const files = [
    path.join(root, "README.md"),
    path.join(root, "CLAUDE.md"),
    ...mdFilesUnder(path.join(root, "docs")),
  ];
  const examples = files.flatMap((file) =>
    vowExamplesIn(readFileSync(file, "utf8")).map((content) => ({ content, file })),
  );
  // Guard against a silent pass: the docs must actually contain examples to check.
  expect(examples.length).toBeGreaterThan(0);

  const drift = examples
    .map((example: Readonly<{ content: string; file: string }>) => ({
      file: example.file,
      reason: checkVowExample(example.content),
    }))
    .filter((entry: Readonly<{ file: string; reason: string | undefined }>) =>
      defined(entry.reason),
    )
    .map(
      (entry: Readonly<{ file: string; reason: string | undefined }>) =>
        `${entry.file.slice(root.length + 1)}: ${entry.reason}`,
    );
  expect(drift).toEqual([]);
});

test("vowExamplesIn picks only fulfills-bearing markdown fences", () => {
  const source = [
    "```markdown",
    "---",
    "id: vow_a",
    "fulfills: emit entity",
    "---",
    "```",
    "",
    "```markdown",
    "app/",
    "  task.vow.md",
    "```",
  ].join("\n");
  const found = vowExamplesIn(source);
  expect(found).toHaveLength(1);
  expect(found[0]).toContain("fulfills: emit entity");
});

test("checkVowExample fails on a removed emit target", () => {
  const content = ["---", "id: vow_x", "fulfills: emit vue", "---", "", "# A demo"].join("\n");
  expect(checkVowExample(content)).toContain('unknown emit target "vue"');
});

test("checkVowExample fails on a malformed id", () => {
  const content = ["---", "id: vow_two_words", "fulfills: emit entity", "---", "", "# A demo"].join(
    "\n",
  );
  expect(checkVowExample(content)).toBeDefined();
});

test("checkVowExample holds for a valid example", () => {
  const content = [
    "---",
    "id: vow_demo",
    "fulfills: emit entity",
    "---",
    "",
    "# A demo entity",
    "",
    "## fields",
    "",
    "- title: text, required",
    "- done: boolean",
  ].join("\n");
  expect(checkVowExample(content)).toBeUndefined();
});

test("every node/attr kind the Vue adapter handles is documented in components.md", () => {
  // The Attr kinds live in render-attr (`case`) and the UiNode kinds in render-node (`node.kind ===`).
  // Feed both — render-vue.ts itself carries no kind dispatch, so a single source would read as empty.
  const sources = [
    readFileSync(path.join(root, "packages/component/src/render-attr.ts"), "utf8"),
    readFileSync(path.join(root, "packages/component/src/render-node.ts"), "utf8"),
  ];
  const doc = readFileSync(path.join(root, "docs/guide/components.md"), "utf8");
  // Guard against a silent pass: the extraction must actually find kinds, or the gate is vacuous.
  expect(adapterKinds(...sources).length).toBeGreaterThan(0);
  expect(undocumentedKinds(sources, doc)).toEqual([]);
});

test("every core field type is documented in emit.md", () => {
  const core = readFileSync(path.join(root, "packages/core/src/vow.ts"), "utf8");
  const doc = readFileSync(path.join(root, "docs/guide/emit.md"), "utf8");
  // Guard against a silent pass: the extraction must actually find field types, or the gate is vacuous.
  expect(coreFieldTypes(core).length).toBeGreaterThan(0);
  expect(undocumentedFieldTypes(core, doc)).toEqual([]);
});

test("undocumentedFieldTypes catches a field type the doc omits (so the gate still bites)", () => {
  expect(undocumentedFieldTypes('FieldType = z.enum(["text"])', "doc with no mention")).toEqual([
    "text",
  ]);
});

test("undocumentedKinds catches a kind the doc omits (so the gate still bites)", () => {
  expect(undocumentedKinds(['case "text":'], "doc with no mention")).toEqual(["text"]);
});

test("the codebase and docs are English-only (no German umlauts or words)", () => {
  // The gate itself defines + tests the German markers, so it legitimately contains them as data.
  const selfReferential = new Set([
    path.join(root, "packages/gate/src/index.ts"),
    path.join(root, "packages/gate/tests/docs-drift.test.ts"),
  ]);
  const scanned = [
    ...sourceFilesUnder(path.join(root, "packages")),
    ...sourceFilesUnder(path.join(root, "apps")),
    ...sourceFilesUnder(path.join(root, "docs/guide")),
    path.join(root, "CLAUDE.md"),
    path.join(root, "README.md"),
  ];
  const offenders = scanned
    .filter((file) => !selfReferential.has(file))
    .map((file) => {
      const src = readFileSync(file, "utf8");
      return { file, hits: [...germanMarkers(src), ...germanWords(src)] };
    })
    .filter(
      (offender: Readonly<{ file: string; hits: readonly string[] }>) => offender.hits.length > 0,
    )
    .map(
      (offender: Readonly<{ file: string; hits: readonly string[] }>) =>
        `${offender.file.slice(root.length + 1)}: ${offender.hits.join(" ")}`,
    );
  expect(offenders).toEqual([]);
});

test("germanWords flags German prose without umlauts, but not English", () => {
  expect(germanWords("ab 10 greift der Rabatt")).toContain("greift");
  expect(germanWords("a discount applies from 10 units")).toEqual([]);
});
