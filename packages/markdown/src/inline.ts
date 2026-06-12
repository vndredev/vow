import type { Attr, UiNode } from "@vow/component";
import { CLOSE, NOOP, openStep, pushStep, runWalk } from "./walk.ts";
import type { Frame, Maybe, Step, Tok } from "./types.ts";
import { NONE, defined } from "./maybe.ts";
import { comp, el, href, sattr, txt } from "./node.ts";

const ICON = "icon";
const VARIANT = /(?:^|[\s,])variant\s*=\s*([\w-]+)/u;
const KIND_GROUP = 1;
const LABEL_GROUP = 2;
const OPTS_GROUP = 3;
const OPEN = "_open";
const CLOSE_SUFFIX = "_close";

/** Build vow's own Icon / Badge component for one `:icon[…]` / `:badge[…]{variant=…}` match. */
function inlinePrimitive(kind: string, label: string, opts: string): UiNode {
  if (kind === ICON) {
    return comp("Icon", [sattr("name", label)], []);
  }
  const attrs: Attr[] = [sattr("label", label)];
  const tone: Maybe<string> = VARIANT.exec(opts)?.[1];
  if (defined(tone)) {
    attrs.push(sattr("tone", tone));
  }
  return comp("Badge", attrs, []);
}

/** The nodes for one `:icon`/`:badge` match: any plain text in `gap`, then the primitive component. */
function matchNodes(gap: string, match: readonly string[]): UiNode[] {
  const out: UiNode[] = [];
  if (gap) {
    out.push(txt(gap));
  }
  const kind = match[KIND_GROUP] ?? "";
  out.push(inlinePrimitive(kind, match[LABEL_GROUP] ?? "", match[OPTS_GROUP] ?? ""));
  return out;
}

/**
 * Split a text run into inline UiNodes, expanding `:icon[name]` and `:badge[label]{variant=…}` into
 * vow's own Icon / Badge components — the docs dogfooding their own primitives in prose.
 */
const INLINE_RE = /:(icon|badge)\[([^\]]+)\](?:\{([^}]*)\})?/gu;
export function textToInlineNodes(content: string): UiNode[] {
  const out: UiNode[] = [];
  let last = 0;
  for (const match of content.matchAll(INLINE_RE)) {
    out.push(...matchNodes(content.slice(last, match.index), match));
    last = match.index + match[0].length;
  }
  if (last < content.length) {
    out.push(txt(content.slice(last)));
  }
  return out;
}

/** The frame an inline `_open` token opens (`link_open` carries an href; else reuse the token's tag). */
function openInlineFrame(token: Tok): Frame {
  if (token.type === "link_open") {
    const url = token.attrGet("href") ?? "#";
    return { build: (kids) => el("a", kids, [href(url)]) };
  }
  const tag = token.tag || "span";
  return { build: (kids) => el(tag, kids) };
}

/** A leaf inline token → a push step (text run, inline code, or a break-as-space). Else absence. */
function leafStep(token: Tok): Maybe<Step> {
  if (token.type === "text") {
    return pushStep(...textToInlineNodes(token.content));
  }
  if (token.type === "code_inline") {
    return pushStep(el("code", [txt(token.content)]));
  }
  if (token.type === "softbreak" || token.type === "hardbreak") {
    return pushStep(txt(" "));
  }
  return NONE;
}

/** A structural inline token → an open/close step (strong/em/link). Else absence. */
function structureStep(token: Tok): Maybe<Step> {
  if (token.type.endsWith(OPEN)) {
    return openStep(openInlineFrame(token));
  }
  if (token.type.endsWith(CLOSE_SUFFIX)) {
    return CLOSE;
  }
  return NONE;
}

/** One inline token → its step: text/code/break push nodes; opens/closes move the frame stack. */
function inlineStep(token: Tok): Step {
  return leafStep(token) ?? structureStep(token) ?? NOOP;
}

/** Inline tokens (a token's `children`) → inline UiNodes: text, strong/em/code, links. */
export function inlineToNodes(children: readonly Tok[]): UiNode[] {
  return runWalk(children, (token) => inlineStep(token));
}
