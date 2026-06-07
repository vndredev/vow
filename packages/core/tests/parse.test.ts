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

test("parseVowMd reads a vow from Markdown: frontmatter + # intent + ## proves", () => {
  const vow = parseVowMd("welcome-card", welcomeCard);
  expect(vow.id).toBe("vow_card");
  expect(vow.slug).toBe("welcome-card"); // from the folder, not the file
  expect(vow.intent).toBe("Welcome to vow"); // the H1
  expect(vow.fulfills).toEqual({ kind: "emit", as: "view" });
  expect(vow.proof).toHaveLength(2);
  expect(vow.proof[0]?.claim).toBe("the intent shows");
  expect(vow.proof[1]?.claim).toBe("HTML in the text is escaped");
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
