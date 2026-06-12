import type { Attr, UiNode } from "./model.ts";
import { escapeHtml } from "./escape.ts";

/**
 * The React adapter for the view tree — render the SAME UiNode tree as render-node.ts (the Vue
 * adapter), but as React JSX. This is the second renderer over one model: the proof that the view
 * model is framework-neutral (one spec, every framework — part of #101).
 *
 * Scope is the core, stateless view nodes only, mirroring render-node.ts's wrapped/frame/leaf shape:
 * element (tag; class -> className, for -> htmlFor), component (PascalCase name), text (escaped via
 * escapeHtml), interp ({expr}), static attrs (name="value"), and bound attrs (name={expr}). Event
 * attrs, conditionals, loops, slots, and the setup/script translation are explicit follow-ups —
 * out of scope here, so they fail loudly rather than render half a feature.
 */

type HostNode = Extract<UiNode, { kind: "component" | "element" }>;

/** How a host's children lay out: self-closing, inline (one line), or block (one child per line). */
type Layout = "block" | "inline" | "self-closing";

/** A host ready to assemble: the `<open` body, the `</close>` name, the children, and their layout. */
interface Wrapped {
  readonly children: readonly UiNode[];
  readonly close: string;
  readonly layout: Layout;
  readonly open: string;
}

const INDENT = "  ";

/** HTML void elements — rendered self-closing (`<input ... />`), never as an open/close pair. */
const VOID_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

/** Vue attribute names React renames: `class` -> `className`, `for` -> `htmlFor`. */
const REACT_ATTR_NAMES = new Map([
  ["class", "className"],
  ["for", "htmlFor"],
]);

/** The JSX attribute name for a Vue-side name (renamed where React differs, e.g. class). */
function reactAttrName(name: string): string {
  return REACT_ATTR_NAMES.get(name) ?? name;
}

/** Render one in-scope attribute as JSX: static `name="value"`, bound `name={expr}`. */
function renderReactAttr(attr: Attr): string {
  if (attr.kind === "static") {
    return `${reactAttrName(attr.name)}="${escapeHtml(attr.value)}"`;
  }
  if (attr.kind === "bound") {
    return `${reactAttrName(attr.name)}={${attr.expr}}`;
  }
  throw new Error(`render-react: attribute kind "${attr.kind}" is out of scope (a #101 follow-up)`);
}

/** Attrs as a leading-space-prefixed string, in array order (no sorting). */
function renderReactAttrs(attrs: readonly Attr[]): string {
  return attrs.map((attr) => ` ${renderReactAttr(attr)}`).join("");
}

/** True when every child is text or interp — the cue to keep them on one line. */
function allInline(children: readonly UiNode[]): boolean {
  return children.every((child) => child.kind === "text" || child.kind === "interp");
}

/** The layout children take: self-closing when forced or empty, inline when all text, else block. */
function layoutFor(
  children: readonly UiNode[],
  forceSelfClose: boolean,
  forceInline: boolean,
): Layout {
  if (forceSelfClose || children.length === 0) {
    return "self-closing";
  }
  if (forceInline || allInline(children)) {
    return "inline";
  }
  return "block";
}

/** The bare name for a host node — a component's PascalCase name, or an element's tag. */
function hostName(node: HostNode): string {
  if (node.kind === "component") {
    return node.name;
  }
  return node.tag;
}

/** An element or component as a `Wrapped`: self-closing for void/empty, inline when marked or all text. */
function wrapHost(node: HostNode): Wrapped {
  const isVoid = node.kind === "element" && VOID_ELEMENTS.has(node.tag);
  const markedInline = node.kind === "element" && node.inline === true;
  return {
    children: node.children,
    close: hostName(node),
    layout: layoutFor(node.children, isVoid, markedInline),
    open: `${hostName(node)}${renderReactAttrs(node.attrs)}`,
  };
}

/** A child renderer — the recursion seam, passed in so this module has no use-before-define cycle. */
type RenderChild = (node: UiNode, depth: number) => string;

/** The inner markup of a `Wrapped`: inline children join flat at depth 0; block children one per line. */
function renderInner(wrapped: Wrapped, depth: number, render: RenderChild): string {
  if (wrapped.layout === "inline") {
    return wrapped.children.map((child) => render(child, 0)).join("");
  }
  return wrapped.children.map((child) => render(child, depth + 1)).join("\n");
}

/** Assemble a `Wrapped` into JSX at `depth`, recursing into children through `render`. */
function frame(wrapped: Wrapped, depth: number, render: RenderChild): string {
  const pad = INDENT.repeat(depth);
  if (wrapped.layout === "self-closing") {
    return `${pad}<${wrapped.open} />`;
  }
  const inner = renderInner(wrapped, depth, render);
  if (wrapped.layout === "inline") {
    return `${pad}<${wrapped.open}>${inner}</${wrapped.close}>`;
  }
  return `${pad}<${wrapped.open}>\n${inner}\n${pad}</${wrapped.close}>`;
}

/** A text/interp leaf at the given pad: text is HTML-escaped, interp becomes JSX's `{expr}`. */
function renderLeaf(node: Extract<UiNode, { kind: "interp" | "text" }>, pad: string): string {
  if (node.kind === "interp") {
    return `${pad}{${node.expr}}`;
  }
  return pad + escapeHtml(node.text);
}

/**
 * Render a UiNode to React JSX at the given indent depth (in INDENT units). Mirrors render-node.ts:
 * a host (element/component) frames its children; a leaf (text/interp) is the base case. Inline when
 * all children are text/interp. Out-of-scope kinds (slot/raw) throw — they are #101 follow-ups.
 */
export function renderReactView(node: UiNode, depth: number): string {
  if (node.kind === "text" || node.kind === "interp") {
    return renderLeaf(node, INDENT.repeat(depth));
  }
  if (node.kind === "element" || node.kind === "component") {
    return frame(wrapHost(node), depth, renderReactView);
  }
  throw new Error(`render-react: node kind "${node.kind}" is out of scope (a #101 follow-up)`);
}
