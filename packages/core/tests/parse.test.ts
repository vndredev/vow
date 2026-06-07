import { expect, test } from "vite-plus/test";
import { parseVowMd } from "../src/index.ts";

// The exact vow.md syntax we settled on — plain Markdown, no invented DSL.
const welcomeCard = `---
id: vow_card
fulfills: emit vue
---
# Welcome to vow

Rendert sein Versprechen als Komponente.

## proves
- der intent erscheint
- HTML im Text wird escaped
`;

test("parseVowMd reads a vow from Markdown: frontmatter + # intent + ## proves", () => {
  const vow = parseVowMd("welcome-card", welcomeCard);
  expect(vow.id).toBe("vow_card");
  expect(vow.slug).toBe("welcome-card"); // from the folder, not the file
  expect(vow.intent).toBe("Welcome to vow"); // the H1
  expect(vow.fulfills).toEqual({ kind: "emit", as: "vue" });
  expect(vow.proof).toHaveLength(2);
  expect(vow.proof[0]?.claim).toBe("der intent erscheint");
  expect(vow.proof[1]?.claim).toBe("HTML im Text wird escaped");
});

test("`fulfills: bind <module>#<export>` parses to a bind fulfilment", () => {
  const md = `---\nid: vow_r\nfulfills: bind @vow/core#rollup\n---\n# Status roll-up\n`;
  const vow = parseVowMd("rollup", md);
  expect(vow.fulfills).toEqual({ kind: "bind", module: "@vow/core", export: "rollup" });
});

test("a pure-composition vow needs no fulfilment and no proof", () => {
  const vow = parseVowMd("epic", `---\nid: vow_e\nkind: epic\n---\n# A grouping epic\n`);
  expect(vow.kind).toBe("epic");
  expect(vow.fulfills).toBeUndefined();
  expect(vow.proof).toEqual([]);
});

test("an invalid vow (no id) fails fast", () => {
  expect(() => parseVowMd("broken", `# No id here\n`)).toThrow();
});

test("parseVowMd reads a ## tree into a single-root TreeNode (indentation = nesting)", () => {
  const md = [
    "---",
    "id: vow_t",
    "fulfills: emit view",
    "---",
    "# A laid-out view",
    "",
    "## tree",
    "- Container(size=3)",
    "  - Flex(direction=column, gap=4)",
    "    - slot",
  ].join("\n");
  const vow = parseVowMd("shell", md);
  expect(vow.tree?.component).toBe("Container");
  expect(vow.tree?.props).toEqual({ size: "3" });
  const flex = vow.tree?.children[0];
  expect(flex?.component).toBe("Flex");
  expect(flex?.props).toEqual({ direction: "column", gap: "4" });
  expect(flex?.children[0]?.component).toBe("slot");
});

test("a vow without a ## tree has no tree", () => {
  const vow = parseVowMd("task", `---\nid: vow_x\nfulfills: emit entity\n---\n# A task\n`);
  expect(vow.tree).toBeUndefined();
});

test("a ## tree with more than one root fails fast", () => {
  const md = `---\nid: vow_m\nfulfills: emit view\n---\n# Two roots\n\n## tree\n- Flex\n- Grid\n`;
  expect(() => parseVowMd("bad", md)).toThrow();
});

test("root: true in the frontmatter marks the entry page", () => {
  const md = `---\nid: vow_r\nfulfills: emit view\nroot: true\n---\n# Home\n\n## tree\n- Container\n`;
  expect(parseVowMd("home", md).root).toBe(true);
  const plain = parseVowMd("x", `---\nid: vow_x\nfulfills: emit entity\n---\n# A plain entity\n`);
  expect(plain.root).toBeUndefined();
});

test("a quoted tree line parses as a text node", () => {
  const md = [
    "---",
    "id: vow_s",
    "fulfills: emit view",
    "---",
    "# A captioned box",
    "",
    "## tree",
    "- Box",
    '  - "Hello world"',
  ].join("\n");
  const text = parseVowMd("captioned", md).tree?.children[0];
  expect(text?.component).toBe("text");
  expect(text?.props).toEqual({ value: "Hello world" });
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
  const view = parseVowMd("page", md).view;
  expect(view?.[0]).toEqual({ type: "hero", value: { title: "Welcome", lead: "Build it" } });
  expect(view?.[1]).toEqual({ type: "list", value: "task" });
  expect(view?.[2]?.type).toBe("flex");
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
  expect(() => parseVowMd("bad", md)).toThrow();
});
