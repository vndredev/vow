import type { Attr, UiNode } from "@vow/component";

/** An HTML element node — children + optional static/bound attrs. */
export const el = (
  tag: string,
  children: readonly UiNode[],
  attrs: readonly Attr[] = [],
): UiNode => ({
  attrs,
  children,
  kind: "element",
  tag,
});

/** A literal text node. */
export const txt = (text: string): UiNode => ({ kind: "text", text });

/** A raw HTML node — the escape hatch for already-rendered, build-time-trusted markup (Shiki). */
export const raw = (html: string): UiNode => ({ html, kind: "raw" });

/** A static `href` attribute. */
export const href = (url: string): Attr => ({ kind: "static", name: "href", value: url });

/** A static attribute — a literal value written verbatim into the markup. */
export const sattr = (name: string, value: string): Attr => ({ kind: "static", name, value });

/** A bound attribute — an adapter-neutral expression the adapter renders in its own syntax. */
export const bound = (name: string, expr: string): Attr => ({ expr, kind: "bound", name });

/** Another component node, referenced by PascalCase name. */
export const comp = (
  name: string,
  attrs: readonly Attr[],
  children: readonly UiNode[],
): UiNode => ({
  attrs,
  children,
  kind: "component",
  name,
});

/** The concatenated text of a node tree (for a heading's slug + TOC label). */
export function textOf(nodes: readonly UiNode[]): string {
  let out = "";
  for (const node of nodes) {
    if (node.kind === "text") {
      out += node.text;
    } else if ("children" in node) {
      out += textOf(node.children);
    }
  }
  return out;
}
