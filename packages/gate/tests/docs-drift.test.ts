// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { checkVowExample, vowExamplesIn } from "../src/index.ts";

// packages/gate/tests → repo root
const root = join(import.meta.dirname, "..", "..", "..");

/** Every `*.md` under a dir, recursively — skipping node_modules and dotfolders. */
function mdFilesUnder(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    let children: string[];
    try {
      children = readdirSync(d);
    } catch {
      return; // missing dir → nothing to scan
    }
    for (const name of children) {
      if (name === "node_modules" || name.startsWith(".")) continue;
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (name.endsWith(".md")) out.push(p);
    }
  };
  walk(dir);
  return out;
}

test("every vow.md example in the docs/README parses against the real core (no drift)", () => {
  const files = [
    join(root, "README.md"),
    join(root, "CLAUDE.md"),
    ...mdFilesUnder(join(root, "docs")),
  ];
  const examples = files.flatMap((file) =>
    vowExamplesIn(readFileSync(file, "utf8")).map((content) => ({ file, content })),
  );
  // Guard against a silent pass: the docs must actually contain examples to check.
  expect(examples.length).toBeGreaterThan(0);

  const drift = examples
    .map(({ file, content }) => ({ file, reason: checkVowExample(content) }))
    .filter((d) => d.reason !== null)
    .map((d) => `${d.file.slice(root.length + 1)}: ${d.reason}`);
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
  expect(checkVowExample(content)).not.toBeNull();
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
  expect(checkVowExample(content)).toBeNull();
});
