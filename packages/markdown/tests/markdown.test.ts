import type { ElementNode, RawNode } from "@vow/component";
import { expect, test } from "vite-plus/test";
import { markdownToNodes, markdownToNodesSync } from "../src/index.ts";

test("markdownToNodesSync without a highlighter renders code as a plain <pre><code>", () => {
  const [code] = markdownToNodesSync("```ts\nconst a = 1;\n```");
  expect(code).toMatchObject({ kind: "element", tag: "pre" });
  const inner = (code as ElementNode).children[0] as ElementNode;
  expect(inner.tag).toBe("code");
});

test("headings and paragraphs map to element nodes", async () => {
  const nodes = await markdownToNodes("# Title\n\nHello world.");
  expect(nodes[0]).toMatchObject({ kind: "element", tag: "h1" });
  expect(nodes[1]).toMatchObject({ kind: "element", tag: "p" });
});

test("inline strong / em / code / link become nested element nodes", async () => {
  const p = (await markdownToNodes("a **b** _c_ `d` [e](/x)"))[0] as ElementNode;
  const tags = p.children.map((c) => ("tag" in c ? c.tag : c.kind));
  expect(tags).toContain("strong");
  expect(tags).toContain("em");
  expect(tags).toContain("code");
  expect(tags).toContain("a");
});

test("a link carries its href as a static attr", async () => {
  const p = (await markdownToNodes("[docs](/guide/)"))[0] as ElementNode;
  const link = p.children[0] as ElementNode;
  expect(link.tag).toBe("a");
  expect(link.attrs[0]).toMatchObject({ name: "href", value: "/guide/" });
});

test("a fenced code block becomes a raw, Shiki-highlighted node (v-pre)", async () => {
  const code = (await markdownToNodes("```ts\nconst a = 1;\n```"))[0] as RawNode;
  expect(code.kind).toBe("raw");
  expect(code.html).toContain("shiki");
  expect(code.html).toContain("v-pre");
});

test("a ::: warning container becomes a callout node (class + data-kind + title)", async () => {
  const callout = (
    await markdownToNodes("::: warning Heads up\nBe careful.\n:::")
  )[0] as ElementNode;
  expect(callout.tag).toBe("div");
  expect(callout.attrs).toContainEqual({ kind: "static", name: "class", value: "vow-callout" });
  expect(callout.attrs).toContainEqual({ kind: "static", name: "data-kind", value: "warning" });
  expect(JSON.stringify(callout.children)).toContain("Heads up");
});

test("a ::: code-group container becomes a grouped code wrapper", async () => {
  const group = (
    await markdownToNodes("::: code-group\n```bash\nnpm i\n```\n:::")
  )[0] as ElementNode;
  expect(group.attrs).toContainEqual({ kind: "static", name: "class", value: "vow-code-group" });
});

test("a bullet list maps to ul > li", async () => {
  const ul = (await markdownToNodes("- one\n- two"))[0] as ElementNode;
  expect(ul.tag).toBe("ul");
  expect(ul.children).toHaveLength(2);
  expect((ul.children[0] as ElementNode).tag).toBe("li");
});
