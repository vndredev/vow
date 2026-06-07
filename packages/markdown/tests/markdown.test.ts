import type { ComponentNode, ElementNode, RawNode } from "@vow/component";
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

test("a ::: code-group becomes a CodeGroup component carrying the fence labels", async () => {
  const group = (
    await markdownToNodes(
      "::: code-group\n```bash [pnpm]\npnpm i\n```\n```bash [npm]\nnpm i\n```\n:::",
    )
  )[0] as ComponentNode;
  expect(group.kind).toBe("component");
  expect(group.name).toBe("CodeGroup");
  expect(group.attrs).toContainEqual({ kind: "bound", name: "labels", expr: "['pnpm', 'npm']" });
});

test("a <<< snippet line includes the resolved file as a code block", () => {
  const nodes = markdownToNodesSync("<<< ./adapter.ts{ts}", {
    resolveSnippet: (path) => (path === "./adapter.ts" ? "export const a = 1;" : null),
  });
  const pre = nodes[0] as ElementNode;
  expect(pre.tag).toBe("pre"); // no highlighter → plain <pre><code>
  expect(JSON.stringify(pre)).toContain("export const a = 1;");
});

test("h2/h3 headings get slug ids and feed the toc", () => {
  const toc: { level: number; text: string; slug: string }[] = [];
  const nodes = markdownToNodesSync("## Run the starter\n\ntext\n\n### A sub-step", { toc });
  expect(toc).toEqual([
    { level: 2, text: "Run the starter", slug: "run-the-starter" },
    { level: 3, text: "A sub-step", slug: "a-sub-step" },
  ]);
  const h2 = nodes[0] as ElementNode;
  expect(h2.attrs).toContainEqual({ kind: "static", name: "id", value: "run-the-starter" });
});

test("duplicate and non-Latin headings get unique, non-empty slug ids", () => {
  const toc: { level: number; text: string; slug: string }[] = [];
  markdownToNodesSync("## Usage\n\n## Usage\n\n## 日本語", { toc });
  expect(toc.map((e) => e.slug)).toEqual(["usage", "usage-1", "section"]);
});

test("a task-list item renders the Checkbox primitive (checked/unchecked, disabled)", () => {
  const nodes = markdownToNodesSync("- [x] done\n- [ ] todo");
  const ul = nodes[0] as ElementNode;
  const li0 = ul.children[0] as ElementNode;
  expect(li0.attrs).toContainEqual({ kind: "static", name: "class", value: "vow-task" });
  const box0 = li0.children[0] as ComponentNode;
  expect(box0.name).toBe("Checkbox");
  expect(box0.attrs).toContainEqual({ kind: "bound", name: "modelValue", expr: "true" });
  expect(box0.attrs).toContainEqual({ kind: "bound", name: "disabled", expr: "true" });
  const box1 = (ul.children[1] as ElementNode).children[0] as ComponentNode;
  expect(box1.attrs).toContainEqual({ kind: "bound", name: "modelValue", expr: "false" });
});

test("a bullet list maps to ul > li", async () => {
  const ul = (await markdownToNodes("- one\n- two"))[0] as ElementNode;
  expect(ul.tag).toBe("ul");
  expect(ul.children).toHaveLength(2);
  expect((ul.children[0] as ElementNode).tag).toBe("li");
});
