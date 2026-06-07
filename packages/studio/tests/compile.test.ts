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
