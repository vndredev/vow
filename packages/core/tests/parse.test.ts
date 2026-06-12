import { expect, test } from "vite-plus/test";
import { parseVowMd } from "../src/index.ts";

// The exact vow.md syntax we settled on — plain Markdown, no invented DSL.
const welcomeCard = `---
id: vow_card
fulfills: emit view
---
# Welcome to vow

Renders its promise as a component.

## proves
- the intent shows
- HTML in the text is escaped
`;

// The number of proves (named, not a magic number).
const TWO_PROVES = 2;
// The index of the third `## view` node (the `flex` block).
const THIRD = 2;

// A field-md builder for one `## fields` type — hoisted (it captures nothing from its test).
const fieldMd = (type: string): string =>
  `---\nid: vow_widget\nfulfills: emit entity\n---\n# Widget\n\n## fields\n- status: ${type}\n`;

test("parseVowMd reads a vow from Markdown: frontmatter + # intent + ## proves", () => {
  const vow = parseVowMd("welcome-card", welcomeCard);
  expect(vow.id).toBe("vow_card");
  // From the folder, not the file.
  expect(vow.slug).toBe("welcome-card");
  // The H1.
  expect(vow.intent).toBe("Welcome to vow");
  expect(vow.fulfills).toEqual({ as: "view", kind: "emit" });
  expect(vow.proof).toHaveLength(TWO_PROVES);
  expect(vow.proof[0]?.claim).toBe("the intent shows");
  expect(vow.proof[1]?.claim).toBe("HTML in the text is escaped");
});

test("a `## fields` reference(entity) parses to a reference field with its target", () => {
  const md = `---\nid: vow_issue\nfulfills: emit entity\n---\n# An issue\n\n## fields\n- title: text, required\n- assignee: reference(user)\n`;
  const { fields } = parseVowMd("issue", md);
  expect(fields[1]).toEqual({ name: "assignee", ref: "user", required: false, type: "reference" });
});

test("a select keeps its head intact when a comma or `required` follows", () => {
  // A comma INSIDE the parens must not strand the head on "select(a".
  expect(parseVowMd("widget", fieldMd("select(a, b)")).fields[0]).toEqual({
    name: "status",
    options: ["a, b"],
    required: false,
    type: "select",
  });
  // A real select + a trailing `required` flag.
  expect(parseVowMd("widget", fieldMd("select(low|high), required")).fields[0]).toEqual({
    name: "status",
    options: ["low", "high"],
    required: true,
    type: "select",
  });
});

test("a malformed type with unbalanced parens throws a clear error", () => {
  const md = `---\nid: vow_widget\nfulfills: emit entity\n---\n# Widget\n\n## fields\n- status: select(a\n`;
  expect(() => parseVowMd("widget", md)).toThrow(/malformed type/u);
});

test("`fulfills: bind <module>#<export>` parses to a bind fulfilment", () => {
  const md = `---\nid: vow_r\nfulfills: bind @vow/core#rollup\n---\n# Status roll-up\n`;
  const vow = parseVowMd("rollup", md);
  expect(vow.fulfills).toEqual({ export: "rollup", kind: "bind", module: "@vow/core" });
});

test("a pure-composition vow needs no fulfilment and no proof", () => {
  const vow = parseVowMd("epic", `---\nid: vow_e\n---\n# A grouping epic\n`);
  expect(vow.intent).toBe("A grouping epic");
  expect(vow.fulfills).toBeUndefined();
  expect(vow.proof).toEqual([]);
});

test("an invalid vow (no id) fails fast", () => {
  expect(() => parseVowMd("broken", `# No id here\n`)).toThrow();
});

test("root: true in the frontmatter marks the entry page", () => {
  const md = `---\nid: vow_r\nfulfills: emit view\nroot: true\n---\n# Home\n`;
  expect(parseVowMd("home", md).root).toBe(true);
  const plain = parseVowMd("x", `---\nid: vow_x\nfulfills: emit entity\n---\n# A plain entity\n`);
  expect(plain.root).toBeUndefined();
});

test("parseVowMd reads a ## view YAML block into a list of components", () => {
  const md = [
    "---",
    "id: vow_v",
    "fulfills: emit view",
    "---",
    "# A page",
    "",
    "## view",
    "```yaml",
    "- hero:",
    "    title: Welcome",
    "    lead: Build it",
    "- list: task",
    "- flex:",
    "    gap: 4",
    "    children:",
    "      - text: hi",
    "```",
  ].join("\n");
  const { view } = parseVowMd("page", md);
  expect(view?.[0]).toEqual({ type: "hero", value: { lead: "Build it", title: "Welcome" } });
  expect(view?.[1]).toEqual({ type: "list", value: "task" });
  expect(view?.[THIRD]?.type).toBe("flex");
});

test("a ## view item with more than one key fails fast", () => {
  const md = [
    "---",
    "id: vow_b",
    "fulfills: emit view",
    "---",
    "# Bad",
    "",
    "## view",
    "```yaml",
    "- hero: {}",
    "  list: task",
    "```",
  ].join("\n");
  expect(() => parseVowMd("bad", md)).toThrow(/exactly one component key/u);
});

test("an unknown `fulfills` verb throws a clear error naming the expected forms", () => {
  const md = `---\nid: vow_x\nfulfills: render entity\n---\n# X\n`;
  expect(() => parseVowMd("x", md)).toThrow(/unknown fulfilment/u);
});

test("frontmatter title + nav round-trip into the Vow (the app shell, declared)", () => {
  const md = [
    "---",
    "id: vow_home",
    "fulfills: emit view",
    "root: true",
    "title: vow studio",
    "nav: { label: Tasks, icon: list-checks, order: 2, group: Plan }",
    "shell: { nav: sidebar-left, width: full, variant: cards }",
    "---",
    "# Home",
    "",
    "## view",
    "```yaml",
    "- h1: Hi",
    "```",
  ].join("\n");
  const vow = parseVowMd("home", md);
  expect(vow.title).toBe("vow studio");
  expect(vow.nav).toEqual({ group: "Plan", icon: "list-checks", label: "Tasks", order: 2 });
  expect(vow.shell).toEqual({ nav: "sidebar-left", variant: "cards", width: "full" });
});

test("a ## seed block parses to a list of sample records", () => {
  const md = [
    "---",
    "id: vow_task",
    "fulfills: emit entity",
    "---",
    "# A task",
    "",
    "## fields",
    "- title: text, required",
    "",
    "## seed",
    "```yaml",
    "- { title: First, status: done }",
    "- { title: Second, status: todo }",
    "```",
  ].join("\n");
  expect(parseVowMd("task", md).seed).toEqual([
    { status: "done", title: "First" },
    { status: "todo", title: "Second" },
  ]);
});
