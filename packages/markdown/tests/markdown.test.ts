import type { ComponentNode, ElementNode, RawNode, UiNode } from "@vow/component";
import { expect, test } from "vite-plus/test";
import { markdownToNodes, markdownToNodesSync } from "../src/index.ts";

const H2_LEVEL = 2;
const H3_LEVEL = 3;
const TWO_ITEMS = 2;

/** One collected "on this page" entry — the read-only shape `markdownToNodesSync` appends to a `toc`. */
interface TocEntry {
  readonly level: number;
  readonly slug: string;
  readonly text: string;
}

/** The snippet resolver used by the `<<<` include test — module-scoped (it captures nothing). */
const SNIPPETS: Record<string, string> = { "./adapter.ts": "export const a = 1;" };
const resolveSnippet = (path: string): string | undefined => SNIPPETS[path];

/** A node's tag (elements) or its kind (everything else) — used to assert inline node shapes. */
function tagOrKind(node: UiNode): string {
  if ("tag" in node) {
    return node.tag;
  }
  return node.kind;
}

/** Narrow a node to an element (throws if it is not) — a checked replacement for an `as` cast. */
function asElement(node: UiNode | undefined): ElementNode {
  if (node?.kind !== "element") {
    throw new Error(`expected an element node, got ${node?.kind ?? "nothing"}`);
  }
  return node;
}

/** Narrow a node to a component (throws if it is not). */
function asComponent(node: UiNode | undefined): ComponentNode {
  if (node?.kind !== "component") {
    throw new Error(`expected a component node, got ${node?.kind ?? "nothing"}`);
  }
  return node;
}

/** Narrow a node to a raw node (throws if it is not). */
function asRaw(node: UiNode | undefined): RawNode {
  if (node?.kind !== "raw") {
    throw new Error(`expected a raw node, got ${node?.kind ?? "nothing"}`);
  }
  return node;
}

test("markdownToNodesSync without a highlighter renders code as a plain <pre><code>", () => {
  const [code] = markdownToNodesSync("```ts\nconst a = 1;\n```");
  expect(code).toMatchObject({ kind: "element", tag: "pre" });
  const inner = asElement(asElement(code).children[0]);
  expect(inner.tag).toBe("code");
});

test("headings and paragraphs map to element nodes", async () => {
  const nodes = await markdownToNodes("# Title\n\nHello world.");
  expect(nodes[0]).toMatchObject({ kind: "element", tag: "h1" });
  expect(nodes[1]).toMatchObject({ kind: "element", tag: "p" });
});

test("inline strong / em / code / link become nested element nodes", async () => {
  const nodes = await markdownToNodes("a **b** _c_ `d` [e](/x)");
  const paragraph = asElement(nodes[0]);
  const tags = paragraph.children.map((child) => tagOrKind(child));
  expect(tags).toContain("strong");
  expect(tags).toContain("em");
  expect(tags).toContain("code");
  expect(tags).toContain("a");
});

test("a link carries its href as a static attr", async () => {
  const nodes = await markdownToNodes("[docs](/guide/)");
  const paragraph = asElement(nodes[0]);
  const link = asElement(paragraph.children[0]);
  expect(link.tag).toBe("a");
  expect(link.attrs[0]).toMatchObject({ name: "href", value: "/guide/" });
});

test("a fenced code block becomes a raw, Shiki-highlighted node (v-pre)", async () => {
  const nodes = await markdownToNodes("```ts\nconst a = 1;\n```");
  const code = asRaw(nodes[0]);
  expect(code.kind).toBe("raw");
  expect(code.html).toContain("shiki");
  expect(code.html).toContain("v-pre");
});

test("a ::: warning container becomes a callout node (class + data-kind + title)", async () => {
  const nodes = await markdownToNodes("::: warning Heads up\nBe careful.\n:::");
  const callout = asElement(nodes[0]);
  expect(callout.tag).toBe("div");
  expect(callout.attrs).toContainEqual({ kind: "static", name: "class", value: "vow-callout" });
  expect(callout.attrs).toContainEqual({ kind: "static", name: "data-kind", value: "warning" });
  expect(JSON.stringify(callout.children)).toContain("Heads up");
});

test("a ::: code-group becomes a CodeGroup component carrying the fence labels", async () => {
  const nodes = await markdownToNodes(
    "::: code-group\n```bash [pnpm]\npnpm i\n```\n```bash [npm]\nnpm i\n```\n:::",
  );
  const group = asComponent(nodes[0]);
  expect(group.kind).toBe("component");
  expect(group.name).toBe("CodeGroup");
  expect(group.attrs).toContainEqual({ expr: "['pnpm', 'npm']", kind: "bound", name: "labels" });
});

test("a <<< snippet line includes the resolved file as a code block", () => {
  const nodes = markdownToNodesSync("<<< ./adapter.ts{ts}", { resolveSnippet });
  // No highlighter, so a plain <pre><code>.
  const pre = asElement(nodes[0]);
  expect(pre.tag).toBe("pre");
  expect(JSON.stringify(pre)).toContain("export const a = 1;");
});

test("h2/h3 headings get slug ids and feed the toc", () => {
  const toc: TocEntry[] = [];
  const nodes = markdownToNodesSync("## Run the starter\n\ntext\n\n### A sub-step", { toc });
  expect(toc).toEqual([
    { level: H2_LEVEL, slug: "run-the-starter", text: "Run the starter" },
    { level: H3_LEVEL, slug: "a-sub-step", text: "A sub-step" },
  ]);
  const heading = asElement(nodes[0]);
  expect(heading.attrs).toContainEqual({ kind: "static", name: "id", value: "run-the-starter" });
});

test("duplicate and non-Latin headings get unique, non-empty slug ids", () => {
  const toc: TocEntry[] = [];
  markdownToNodesSync("## Usage\n\n## Usage\n\n## 日本語", { toc });
  expect(toc.map((entry) => entry.slug)).toEqual(["usage", "usage-1", "section"]);
});

test("a task-list item renders the Checkbox primitive (checked/unchecked, disabled)", () => {
  const nodes = markdownToNodesSync("- [x] done\n- [ ] todo");
  const list = asElement(nodes[0]);
  const firstItem = asElement(list.children[0]);
  expect(firstItem.attrs).toContainEqual({ kind: "static", name: "class", value: "vow-task" });
  const firstBox = asComponent(firstItem.children[0]);
  expect(firstBox.name).toBe("Checkbox");
  expect(firstBox.attrs).toContainEqual({ expr: "true", kind: "bound", name: "modelValue" });
  expect(firstBox.attrs).toContainEqual({ expr: "true", kind: "bound", name: "disabled" });
  const secondBox = asComponent(asElement(list.children[1]).children[0]);
  expect(secondBox.attrs).toContainEqual({ expr: "false", kind: "bound", name: "modelValue" });
});

test("a bullet list maps to ul > li", async () => {
  const nodes = await markdownToNodes("- one\n- two");
  const list = asElement(nodes[0]);
  expect(list.tag).toBe("ul");
  expect(list.children).toHaveLength(TWO_ITEMS);
  expect(asElement(list.children[0]).tag).toBe("li");
});
