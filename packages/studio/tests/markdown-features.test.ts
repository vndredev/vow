import { expect, test } from "vite-plus/test";
import { transformContainers } from "../src/markdown/containers.ts";
import { mapOutsideFences } from "../src/markdown/fences.ts";
import { hoistBlocks } from "../src/markdown/hoist.ts";
import { transformSnippets } from "../src/markdown/snippet.ts";
import { slugify } from "../src/markdown/toc.ts";

test("mapOutsideFences transforms text outside fences, leaves fenced code untouched", () => {
  expect(mapOutsideFences("a\n```\nb\n```\nc", (t) => t.toUpperCase())).toBe("A\n```\nb\n```\nC");
});

test("hoistBlocks pulls script/style out of the body (but not from a code fence)", () => {
  const { body, blocks } = hoistBlocks("# H\n\n<script setup>\nconst a = 1;\n</script>\n\ntext\n");
  expect(blocks.length).toBe(1);
  expect(blocks[0]).toContain("const a = 1;");
  expect(body).not.toContain("<script");
  expect(body).toContain("# H");

  const fenced = hoistBlocks("```html\n<script>x</script>\n```\n");
  expect(fenced.blocks).toEqual([]);
  expect(fenced.body).toContain("<script>x</script>");
});

test("transformContainers converts a known ::: kind, leaves others, skips fences", () => {
  const out = transformContainers("::: warning Heads up\nbe careful\n:::\n");
  expect(out).toContain('<Callout kind="warning" title="Heads up">');
  expect(out).toContain("be careful");
  expect(out).toContain("</Callout>");

  expect(transformContainers("::: unknown\nx\n:::\n")).toContain("::: unknown");
  expect(transformContainers("```\n::: warning\n:::\n```\n")).not.toContain("<Callout");
});

test("transformSnippets inlines <<< as a fence from the reader (but not inside a fence)", () => {
  const out = transformSnippets("<<< ./x.ts{ts}\n", () => "const x = 1;");
  expect(out).toContain("```ts");
  expect(out).toContain("const x = 1;");

  expect(transformSnippets("```\n<<< ./x.ts\n```\n", () => "NOPE")).not.toContain("NOPE");
});

test("slugify makes url-safe anchors", () => {
  expect(slugify("Hello, World!")).toBe("hello-world");
  expect(slugify("a11y is tested")).toBe("a11y-is-tested");
});
