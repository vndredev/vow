import type { Attr, UiNode } from "@vow/component";
import MarkdownIt from "markdown-it";
import container from "markdown-it-container";
import type { Highlighter } from "shiki";
import { getHighlighter, highlight } from "./highlight.ts";

export { getHighlighter, highlight } from "./highlight.ts";

/** The `:::` container kinds: callouts, code-group (a tab switcher), and demo (a live primitive). */
const CONTAINERS = ["tip", "info", "warning", "danger", "code-group", "demo"];

/** PascalCase a word (`checkbox` → `Checkbox`, `code-group` → `CodeGroup`). */
const pascal = (s: string): string =>
  s.replace(/(^|[-_\s])(\w)/g, (_m, _sep, c) => c.toUpperCase());

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
const bound = (name: string, expr: string): Attr => ({ kind: "bound", name, expr });
const comp = (name: string, attrs: Attr[], children: UiNode[]): UiNode => ({
  kind: "component",
  name,
  attrs,
  children,
});

/** One "on this page" entry — a heading's level (2|3), text, and slug id. */
export interface TocEntry {
  readonly level: number;
  readonly text: string;
  readonly slug: string;
}

/** A heading slug: lowercase, spaces → "-", non-word stripped (the anchor id). */
const slug = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");

/** The concatenated text of a node tree (for a heading's slug + TOC label). */
function textOf(nodes: readonly UiNode[]): string {
  let out = "";
  for (const n of nodes) {
    if (n.kind === "text") out += n.text;
    else if ("children" in n) out += textOf(n.children);
  }
  return out;
}

/** A `:::` callout container → a styled box with an optional title (code-group is handled inline). */
function calloutNode(name: string, title: string, kids: UiNode[]): UiNode {
  const children = title
    ? [el("p", [txt(title)], [sattr("class", "vow-callout__title")]), ...kids]
    : kids;
  return el("div", children, [sattr("class", "vow-callout"), sattr("data-kind", name)]);
}

/** A node being assembled from its children, closed on the matching `_close` token. A `tabs` marker
    (set for `::: code-group`) collects the inner fences' `[label]`s for the CodeGroup component. */
interface Frame {
  readonly kids: UiNode[];
  readonly build: (kids: UiNode[]) => UiNode;
  readonly tabs?: { labels: string[] };
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

/** Block tokens → block UiNodes. Tag-driven opens (p/h2/ul/li/blockquote); fences → code node;
    h2/h3 get a slug id and (if `toc` is given) feed the "on this page" entries. */
function blockToNodes(tokens: readonly Tok[], hl?: Highlighter, toc?: TocEntry[]): UiNode[] {
  const root: UiNode[] = [];
  const stack: Frame[] = [];
  const sink = (): UiNode[] => stack[stack.length - 1]?.kids ?? root;
  // a per-page slug counter — empty (e.g. non-Latin) headings fall back to "section", and a repeated
  // slug gets a -1/-2 suffix, so heading ids (and the TOC/search anchors) stay unique.
  const seen = new Map<string, number>();
  const uniqueSlug = (text: string): string => {
    const base = slug(text) || "section";
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return n === 0 ? base : `${base}-${n}`;
  };
  for (const t of tokens) {
    if (t.type === "inline") {
      for (const node of inlineToNodes(t.children ?? [])) sink().push(node);
    } else if (t.type === "fence" || t.type === "code_block") {
      const open = stack[stack.length - 1];
      if (open?.tabs) {
        const label =
          /\[([^\]]+)\]/.exec(t.info)?.[1]?.trim() ?? t.info.trim().split(/\s+/)[0] ?? "";
        open.tabs.labels.push(label);
      }
      sink().push(codeNode(t.content, t.info, hl));
    } else if (t.type === "hr") {
      sink().push(el("hr", []));
    } else if (t.type.startsWith("container_") && t.type.endsWith("_open")) {
      const name = t.type.slice("container_".length, -"_open".length);
      if (name === "code-group") {
        const tabs = { labels: [] as string[] };
        // single-quoted array literal — the bound attr is rendered double-quoted (`:labels="…"`).
        const expr = (): string =>
          `[${tabs.labels.map((l) => `'${l.replace(/'/g, "\\'")}'`).join(", ")}]`;
        stack.push({
          kids: [],
          tabs,
          build: (k) => comp("CodeGroup", [bound("labels", expr())], k),
        });
      } else if (name === "demo") {
        // `::: demo <primitive>` → a live demo component (@vow/docs generates it). No raw Vue.
        const demo = "VowDemo" + pascal(t.info.trim().slice("demo".length).trim());
        stack.push({ kids: [], build: () => comp(demo, [], []) });
      } else {
        const title = t.info.trim().slice(name.length).trim();
        stack.push({ kids: [], build: (k) => calloutNode(name, title, k) });
      }
    } else if (t.type.startsWith("container_") && t.type.endsWith("_close")) {
      const top = stack.pop();
      if (top) sink().push(top.build(top.kids));
    } else if (t.type === "heading_open") {
      const tag = t.tag;
      const level = Number(tag.slice(1));
      stack.push({
        kids: [],
        build: (k) => {
          if (toc && (level === 2 || level === 3)) {
            const text = textOf(k);
            const s = uniqueSlug(text);
            toc.push({ level, text, slug: s });
            return el(tag, k, [sattr("id", s)]);
          }
          return el(tag, k);
        },
      });
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

/** Options for the sync render path. */
export interface MarkdownOptions {
  /** A pre-warmed Shiki highlighter (else fenced code is a plain `<pre>`). */
  readonly highlighter?: Highlighter;
  /** Read a `<<< <path>` snippet's content (relative to the source file); null = not found. */
  readonly resolveSnippet?: (path: string) => string | null;
  /** If given, the page's h2/h3 headings are collected here (the "on this page" TOC). */
  readonly toc?: TocEntry[];
}

/** A `<<< <path>` (optionally `{lang}`) line that includes a file as a fenced code block. */
const SNIPPET = /^<<<\s+(\S+?)(?:\{(\w+)\})?[ \t]*$/gm;

/** Expand `<<< <path>` lines into fenced code blocks (read via `resolve`), before markdown-it. */
function expandSnippets(src: string, resolve: (path: string) => string | null): string {
  return src.replace(SNIPPET, (_match, path: string, lang?: string) => {
    const content = resolve(path);
    if (content === null) return "```\n[snippet not found: " + path + "]\n```";
    const lng = lang ?? path.split(".").pop() ?? "";
    return "```" + lng + "\n" + content.replace(/\n$/, "") + "\n```";
  });
}

/**
 * Render markdown to vow's UiNode model with an already-loaded highlighter — the sync path the
 * generator uses (Shiki is pre-warmed once). Without a highlighter, fenced code is a plain `<pre>`;
 * `resolveSnippet` enables `<<< <path>` file includes.
 */
export function markdownToNodesSync(source: string, opts: MarkdownOptions = {}): UiNode[] {
  const src = opts.resolveSnippet ? expandSnippets(source, opts.resolveSnippet) : source;
  return blockToNodes(md.parse(src, {}), opts.highlighter, opts.toc);
}

/**
 * Render markdown to vow's UiNode model — the reusable prose engine. Headings/paragraphs/lists/inline
 * map to element + text nodes; fenced code becomes a raw, Shiki-highlighted node (the escape hatch).
 * Adapter-neutral: a React/Solid adapter renders the same nodes. Async because Shiki loads grammars.
 */
export async function markdownToNodes(source: string): Promise<UiNode[]> {
  return markdownToNodesSync(source, { highlighter: await getHighlighter() });
}
