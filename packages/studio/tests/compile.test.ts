import { expect, test } from "vite-plus/test";
import { compile } from "../src/markdown/compile.ts";

test("compiles frontmatter + prose + a highlighted fence into a Vue SFC", async () => {
  const md = [
    "---",
    "title: Hello",
    "---",
    "# Heading",
    "",
    "Some **bold** text.",
    "",
    "```ts",
    "const x: number = 1;",
    "```",
    "",
  ].join("\n");

  const { code, data } = await compile(md);
  expect(data["title"]).toBe("Hello");
  expect(code.startsWith("<template>")).toBe(true);
  expect(code).toContain('class="vow-doc"');
  expect(code).toContain("<h1>Heading</h1>");
  expect(code).toContain("<strong>bold</strong>");
  expect(code).toContain("shiki"); // the fence was highlighted by Shiki
  expect(code).toContain("v-pre"); // code blocks are v-pre so Vue ignores {{ }} inside
});

test("an unknown fence language falls back to plain text (no throw)", async () => {
  const { code } = await compile("```made-up-lang\nplain content\n```\n");
  expect(code).toContain("shiki");
  expect(code).toContain("plain content");
});

test("a ::: code-group becomes a <Tabs> with one highlighted panel per label", async () => {
  const md = [
    "::: code-group",
    "```ts [config.ts]",
    "export const a = 1;",
    "```",
    "```js [config.js]",
    "module.exports = { a: 1 };",
    "```",
    ":::",
    "",
  ].join("\n");

  const { code } = await compile(md);
  expect(code).toContain("<Tabs :items=");
  expect(code).toContain("config.ts");
  expect(code).toContain("config.js");
  expect(code).toContain("shiki"); // each panel is a highlighted code block
});

test("compiles hoisted script + callout + snippet + a TOC together", async () => {
  const md = [
    "<script setup>",
    "import { ref } from 'vue';",
    "</script>",
    "",
    "## Intro",
    "",
    "::: warning Note",
    "be careful",
    ":::",
    "",
    "<<< ./demo.ts{ts}",
    "",
    "### Details",
    "",
  ].join("\n");

  const { code, toc } = await compile(md, { readSnippet: () => "export const x = 1;" });
  expect(code.startsWith("<script setup>")).toBe(true); // hoisted to the SFC top
  expect(code).toContain('<Callout kind="warning" title="Note">'); // ::: → component
  expect(code).toContain("export"); // snippet inlined + Shiki-highlighted
  expect(code).toContain('id="intro"'); // heading got a slug id
  expect(toc.map((entry) => entry.slug)).toEqual(["intro", "details"]);
  expect(toc[0]?.level).toBe(2);
  expect(toc[1]?.level).toBe(3);
});
