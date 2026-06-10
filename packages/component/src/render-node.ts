import type { SlotNode, UiNode } from "./model.ts";
import { renderAttrs, renderFor } from "./render-attr.ts";
import { defined } from "./defined.ts";
import { escapeHtml } from "./escape.ts";

type HostNode = Extract<UiNode, { kind: "component" | "element" }>;
type LeafNode = Exclude<UiNode, HostNode | SlotNode>;

/** How a node's children lay out: self-closing, inline (one line), or block (one child per line). */
type Layout = "block" | "inline" | "self-closing";

/** A node ready to assemble: the `<open` body, the `</close>` name, the children, and their layout. */
interface Wrapped {
  readonly open: string;
  readonly close: string;
  readonly children: readonly UiNode[];
  readonly layout: Layout;
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

/** A leaf node (text/interp/raw) rendered at the given pad — the non-recursive base cases. */
function renderLeaf(node: LeafNode, pad: string): string {
  if (node.kind === "interp") {
    return `${pad}{{ ${node.expr} }}`;
  }
  if (node.kind === "raw") {
    // Verbatim, trusted HTML (e.g. Shiki). Only the first line is indented; the rest is as-given.
    return pad + node.html;
  }
  return pad + escapeHtml(node.text);
}

/** The `<slot ...` opener: dynamic (`:name`), static (`name`), or the default slot. */
function slotOpener(node: SlotNode): string {
  if (defined(node.nameExpr)) {
    return `slot :name="${node.nameExpr}"`;
  }
  if (defined(node.name)) {
    return `slot name="${node.name}"`;
  }
  return "slot";
}

/** A `<slot>` outlet as a `Wrapped`: a name-only open, a fixed `slot` close, layout by child kind. */
function wrapSlot(node: SlotNode): Wrapped {
  return {
    children: node.children,
    close: "slot",
    layout: layoutFor(node.children, false, false),
    open: slotOpener(node),
  };
}

/** The bare name for a host node — a component's PascalCase name, or an element's tag. */
function hostName(node: HostNode): string {
  if (node.kind === "component") {
    return node.name;
  }
  return node.tag;
}

/** The opener `<tag` body (name/tag + attrs + an optional `v-for`) for an element or component. */
function hostOpener(node: HostNode): string {
  let forPart = "";
  if (defined(node.for)) {
    forPart = renderFor(node.for);
  }
  return `${hostName(node)}${renderAttrs(node.attrs)}${forPart}`;
}

/** An element or component as a `Wrapped`: self-closing for void/empty, inline when marked or all text. */
function wrapHost(node: HostNode): Wrapped {
  const isVoid = node.kind === "element" && VOID_ELEMENTS.has(node.tag);
  const markedInline = node.kind === "element" && node.inline === true;
  return {
    children: node.children,
    close: hostName(node),
    layout: layoutFor(node.children, isVoid, markedInline),
    open: hostOpener(node),
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

/** Assemble a `Wrapped` into markup at `depth`, recursing into children through `render`. */
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

/** A slot/element/component node turned into its `Wrapped` shell. */
function wrapContainer(node: Exclude<UiNode, LeafNode>): Wrapped {
  if (node.kind === "slot") {
    return wrapSlot(node);
  }
  return wrapHost(node);
}

/** Render a UiNode at the given indent depth (in INDENT units). Inline if all children are text/interp. */
export function renderNode(node: UiNode, depth: number): string {
  if (node.kind === "text" || node.kind === "interp" || node.kind === "raw") {
    return renderLeaf(node, INDENT.repeat(depth));
  }
  return frame(wrapContainer(node), depth, renderNode);
}
