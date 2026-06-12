import type { Attr, ConditionalAttr, EventAttr, Loop, UiNode } from "./model.ts";
import { assertAttrName } from "./validate-name.ts";
import { defined } from "./defined.ts";
import { escapeHtml } from "./escape.ts";

/**
 * The React adapter for the view tree — render the SAME UiNode tree as render-node.ts (the Vue
 * adapter), but as React JSX. This is the second renderer over one model: the proof that the view
 * model is framework-neutral (one spec, every framework — part of #101).
 *
 * Scope is structural — mirroring render-node.ts / render-attr.ts: element (tag; class -> className,
 * for -> htmlFor), component (PascalCase name), text (escaped via escapeHtml), interp ({expr}), static
 * attrs (name="value"), bound attrs (name={expr}), event attrs (@click -> onClick={() => expr}),
 * conditionals (v-if -> {expr && (node)}), loops (the for {as, each, key} -> {each.map((as) => node)}),
 * and slots ({children}). The setup/script + data-layer translation stays the strategic follow-up;
 * model attrs, spread attrs, and raw nodes still throw loudly rather than render half a feature.
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

/**
 * DOM events whose React handler is camelCased across a word boundary the bare name can't recover
 * (`dragstart` -> `onDragStart`). Single-word events fall back to first-letter capitalization.
 */
const REACT_EVENT_NAMES = new Map([
  ["dragend", "DragEnd"],
  ["dragenter", "DragEnter"],
  ["dragleave", "DragLeave"],
  ["dragover", "DragOver"],
  ["dragstart", "DragStart"],
  ["keydown", "KeyDown"],
  ["keyup", "KeyUp"],
  ["mousedown", "MouseDown"],
  ["mouseup", "MouseUp"],
]);

/** The JSX attribute name for a Vue-side name (renamed where React differs, e.g. class). */
function reactAttrName(name: string): string {
  return REACT_ATTR_NAMES.get(name) ?? name;
}

/** First-letter-capitalize a single-word event name (`click` -> `Click`, `drop` -> `Drop`). */
function capitalize(name: string): string {
  return `${name.charAt(0).toUpperCase()}${name.slice(1)}`;
}

/** The React handler prop for a DOM event: `click` -> `onClick`, `dragstart` -> `onDragStart`. */
function reactEventName(name: string): string {
  return `on${REACT_EVENT_NAMES.get(name) ?? capitalize(name)}`;
}

/** An event attr as a JSX handler prop: `@click="add"` -> `onClick={() => add}` (modifiers ignored). */
function renderReactEvent(attr: EventAttr): string {
  return `${reactEventName(attr.name)}={() => ${attr.expr}}`;
}

/** Render one in-scope attribute as JSX: static `name="value"`, bound `name={expr}`, event `onX={...}`. */
function renderReactAttr(attr: Attr): string {
  if (attr.kind === "static") {
    return `${reactAttrName(attr.name)}="${escapeHtml(attr.value)}"`;
  }
  if (attr.kind === "bound") {
    assertAttrName(attr.name);
    return `${reactAttrName(attr.name)}={${attr.expr}}`;
  }
  if (attr.kind === "event") {
    return renderReactEvent(attr);
  }
  throw new Error(`render-react: attribute kind "${attr.kind}" is out of scope (a #101 follow-up)`);
}

/** A node's conditional (`v-if`) attr, if present — the one attr that wraps the node, not its tag. */
function conditionOf(attrs: readonly Attr[]): ConditionalAttr | undefined {
  return attrs.find((attr): attr is ConditionalAttr => attr.kind === "cond");
}

/** Attrs as a leading-space-prefixed string, in array order, skipping the wrapping `cond` attr. */
function renderReactAttrs(attrs: readonly Attr[]): string {
  return attrs
    .filter((attr) => attr.kind !== "cond")
    .map((attr) => ` ${renderReactAttr(attr)}`)
    .join("");
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

/** The ` key={expr}` part for a looped host, in React's spot (the opener), or "" when keyless. */
function reactKey(loop?: Loop): string {
  if (defined(loop) && defined(loop.key)) {
    return ` key={${loop.key}}`;
  }
  return "";
}

/** An element or component as a `Wrapped`: self-closing for void/empty, inline when marked or all text. */
function wrapHost(node: HostNode): Wrapped {
  const isVoid = node.kind === "element" && VOID_ELEMENTS.has(node.tag);
  const markedInline = node.kind === "element" && node.inline === true;
  return {
    children: node.children,
    close: hostName(node),
    layout: layoutFor(node.children, isVoid, markedInline),
    open: `${hostName(node)}${renderReactAttrs(node.attrs)}${reactKey(node.for)}`,
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

/** A `{head (` / `tail)}` brace shell around an inner JSX block — the loop/conditional wrappers share it. */
interface Brace {
  readonly head: string;
  readonly tail: string;
}

/** Wrap an inner JSX block in a brace shell at `depth`; `inner` already sits one level deeper. */
function braceWrap(brace: Brace, inner: string, depth: number): string {
  const pad = INDENT.repeat(depth);
  return `${pad}{${brace.head} (\n${inner}\n${pad}${brace.tail})}`;
}

/** A conditional (`v-if`) host as React's `{expr && (node)}` — mounted only when the expr is truthy. */
function wrapConditional(cond: ConditionalAttr, inner: string, depth: number): string {
  return braceWrap({ head: `${cond.expr} &&`, tail: "" }, inner, depth);
}

/** A looped host as React's `{each.map((as) => (node))}` — the `:key` rides the inner element's opener. */
function wrapLoop(loop: Loop, inner: string, depth: number): string {
  return braceWrap({ head: `${loop.each}.map((${loop.as}) =>`, tail: ")" }, inner, depth);
}

/** A slot outlet as React's `{children}` — the slot maps to the universal `children` prop. */
function renderSlot(depth: number): string {
  return `${INDENT.repeat(depth)}{children}`;
}

/** How many indent levels a present wrapper adds (1 per truthy seam, 0 when absent). */
function bump(present: boolean): number {
  if (present) {
    return 1;
  }
  return 0;
}

/**
 * Render a host (element/component), then wrap it in its conditional and loop, outermost-loop-first.
 * The loop wraps the conditional, so each present wrapper deepens the element it holds by one level.
 */
function renderHost(node: HostNode, depth: number, render: RenderChild): string {
  const cond = conditionOf(node.attrs);
  const condDepth = depth + bump(defined(node.for));
  const innerDepth = condDepth + bump(defined(cond));
  let out = frame(wrapHost(node), innerDepth, render);
  if (defined(cond)) {
    out = wrapConditional(cond, out, condDepth);
  }
  if (defined(node.for)) {
    out = wrapLoop(node.for, out, depth);
  }
  return out;
}

/**
 * Render a UiNode to React JSX at the given indent depth (in INDENT units). Mirrors render-node.ts /
 * render-attr.ts structurally: a host (element/component) frames its children and wraps in its
 * conditional ({expr && (node)}) and loop ({each.map(...)}); a slot maps to {children}; a leaf
 * (text/interp) is the base case. The setup/data-layer translation + model/spread/raw stay #101
 * follow-ups — they throw rather than render half a feature.
 */
export function renderReactView(node: UiNode, depth: number): string {
  if (node.kind === "text" || node.kind === "interp") {
    return renderLeaf(node, INDENT.repeat(depth));
  }
  if (node.kind === "slot") {
    return renderSlot(depth);
  }
  if (node.kind === "element" || node.kind === "component") {
    return renderHost(node, depth, renderReactView);
  }
  throw new Error(`render-react: node kind "${node.kind}" is out of scope (a #101 follow-up)`);
}
