import type { Attr, UiNode } from "@vow/component";
import MarkdownIt from "markdown-it";
import container from "markdown-it-container";
import type { Highlighter } from "shiki";
import { getHighlighter, highlight } from "./highlight.ts";

export { getHighlighter, highlight } from "./highlight.ts";

/** The `:::` container kinds we render: callouts (a styled box) + code-group (grouped code blocks). */
const CONTAINERS = ["tip", "info", "warning", "danger", "code-group"];

const md = new MarkdownIt({ html: false, linkify: true });
// markdown-it-container is `(md, name, opts)`; markdown-it's `use` overloads don't model a 3-arg
// plugin, so bridge the type. Runtime is unaffected.
const containerPlugin = container as unknown as Parameters<typeof md.use>[0];
for (const name of CONTAINERS) md.use(containerPlugin, name, {});

/** One markdown-it token (avoids a fragile deep import of the Token type). */
type Tok = ReturnType<typeof md.parse>[number];

const el = (tag: string, children: UiNode[], attrs: Attr[] = []): UiNode => ({
  kind: "element",
  tag,
  attrs,
  children,
});
const txt = (text: string): UiNode => ({ kind: "text", text });
const raw = (html: string): UiNode => ({ kind: "raw", html });
const href = (url: string): Attr => ({ kind: "static", name: "href", value: url });
const sattr = (name: string, value: string): Attr => ({ kind: "static", name, value });

/** A `:::` container → a callout box (with an optional title) or a grouped code block. */
function containerNode(name: string, title: string, kids: UiNode[]): UiNode {
  if (name === "code-group") return el("div", kids, [sattr("class", "vow-code-group")]);
  const children = title
    ? [el("p", [txt(title)], [sattr("class", "vow-callout__title")]), ...kids]
    : kids;
  return el("div", children, [sattr("class", "vow-callout"), sattr("data-kind", name)]);
}

/** A node being assembled from its children, closed on the matching `_close` token. */
interface Frame {
  readonly kids: UiNode[];
  readonly build: (kids: UiNode[]) => UiNode;
}

/** Inline tokens (a token's `children`) → inline UiNodes: text, strong/em/code, links. */
function inlineToNodes(children: readonly Tok[]): UiNode[] {
  const root: UiNode[] = [];
  const stack: Frame[] = [];
  const sink = (): UiNode[] => stack[stack.length - 1]?.kids ?? root;
  for (const t of children) {
    if (t.type === "text") sink().push(txt(t.content));
    else if (t.type === "code_inline") sink().push(el("code", [txt(t.content)]));
    else if (t.type === "softbreak" || t.type === "hardbreak") sink().push(txt(" "));
    else if (t.type === "link_open") {
      const url = t.attrGet("href") ?? "#";
      stack.push({ kids: [], build: (k) => el("a", k, [href(url)]) });
    } else if (t.type.endsWith("_open")) {
      const tag = t.tag || "span";
      stack.push({ kids: [], build: (k) => el(tag, k) });
    } else if (t.type.endsWith("_close")) {
      const top = stack.pop();
      if (top) sink().push(top.build(top.kids));
    }
  }
  return root;
}

/** A fenced block → a raw Shiki node when a highlighter is given, else a plain `<pre><code>`. */
function codeNode(content: string, info: string, hl?: Highlighter): UiNode {
  const code = content.replace(/\n$/, "");
  if (!hl) return el("pre", [el("code", [txt(code)])]);
  const lang = info.trim().split(/\s+/)[0] ?? "";
  return raw(highlight(hl, code, lang));
}

/** Block tokens → block UiNodes. Tag-driven opens (p/h2/ul/li/blockquote); fences → code node. */
function blockToNodes(tokens: readonly Tok[], hl?: Highlighter): UiNode[] {
  const root: UiNode[] = [];
  const stack: Frame[] = [];
  const sink = (): UiNode[] => stack[stack.length - 1]?.kids ?? root;
  for (const t of tokens) {
    if (t.type === "inline") {
      for (const node of inlineToNodes(t.children ?? [])) sink().push(node);
    } else if (t.type === "fence" || t.type === "code_block") {
      sink().push(codeNode(t.content, t.info, hl));
    } else if (t.type === "hr") {
      sink().push(el("hr", []));
    } else if (t.type.startsWith("container_") && t.type.endsWith("_open")) {
      const name = t.type.slice("container_".length, -"_open".length);
      const title = t.info.trim().slice(name.length).trim();
      stack.push({ kids: [], build: (k) => containerNode(name, title, k) });
    } else if (t.type.startsWith("container_") && t.type.endsWith("_close")) {
      const top = stack.pop();
      if (top) sink().push(top.build(top.kids));
    } else if (t.type.endsWith("_open")) {
      const tag = t.tag || "div";
      stack.push({ kids: [], build: (k) => el(tag, k) });
    } else if (t.type.endsWith("_close")) {
      const top = stack.pop();
      if (top) sink().push(top.build(top.kids));
    }
  }
  return root;
}

/**
 * Render markdown to vow's UiNode model with an already-loaded highlighter — the sync path the
 * generator uses (Shiki is pre-warmed once). Without a highlighter, fenced code is a plain `<pre>`.
 */
export function markdownToNodesSync(source: string, hl?: Highlighter): UiNode[] {
  return blockToNodes(md.parse(source, {}), hl);
}

/**
 * Render markdown to vow's UiNode model — the reusable prose engine. Headings/paragraphs/lists/inline
 * map to element + text nodes; fenced code becomes a raw, Shiki-highlighted node (the escape hatch).
 * Adapter-neutral: a React/Solid adapter renders the same nodes. Async because Shiki loads grammars.
 */
export async function markdownToNodes(source: string): Promise<UiNode[]> {
  return markdownToNodesSync(source, await getHighlighter());
}
