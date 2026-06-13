import type { Attr, UiNode } from "./types.ts";
import {
  EVENT_LAYOUTS,
  ISSUE_LAYOUTS,
  LOOP_LAYOUTS,
  eventLayout,
  issueLayout,
  loopLayout,
} from "./layouts.ts";
import { asRecord, defined } from "@vow/core";
import { assertAttrName, assertObjectKey, pascalCase } from "@vow/component";
import { boardComponentName, cardsComponentName, statsComponentName } from "./naming.ts";
import { bound, comp, el, str, txt } from "./helpers.ts";
import { childrenOf, propsToAttrs, sliceAttrs } from "./slice.ts";
import { LAYOUT_PRIMITIVES } from "@vow/layout";
import { PRIMITIVE_ADAPTERS } from "@vow/emit-primitive";

/** The primitive names a `## view` may reference directly (the closed registry, from @vow/emit-primitive). */
export const PRIMITIVES: readonly string[] = Object.keys(PRIMITIVE_ADAPTERS);

/** Plain text-bearing HTML elements a view may use directly (headings, paragraphs, inline). */
const TEXT_TAGS: ReadonlySet<string> = new Set(["h1", "h2", "h3", "p", "span"]);

/** A handler maps one component's raw value to a UiNode; `entities` are the slugs a `list:` may target. */
type Handler = (value: unknown, entities: readonly string[]) => UiNode;

/** Assert a referenced entity slug is known, else throw a clear build error. */
function requireEntity(slug: string, label: string, entities: readonly string[]): void {
  if (!entities.includes(slug)) {
    const known = entities.join(", ") || "none";
    throw new Error(
      `emit-view: \`${label}: ${slug}\` references an unknown entity (known: ${known})`,
    );
  }
}

/** A scalar (`task`) or sliced (`{ of: task, ... }`) entity-reference, resolved to its `{ of }` object. */
function sliceObject(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    return { of: value };
  }
  return asRecord(value);
}

/** A type guard: the value is an array of unknowns. */
function isArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

/** A raw value as an array of items — a non-array becomes empty. */
function asArray(value: unknown): readonly unknown[] {
  if (isArray(value)) {
    return value;
  }
  return [];
}

const hero: Handler = (value): UiNode => {
  const obj = asRecord(value);
  const kids: UiNode[] = [];
  if (defined(obj["eyebrow"])) {
    kids.push({
      attrs: [{ kind: "static", name: "class", value: "vow-eyebrow" }],
      children: [txt(str(obj["eyebrow"]))],
      kind: "element",
      tag: "span",
    });
  }
  if (defined(obj["title"])) {
    kids.push(el("h1", [txt(str(obj["title"]))]));
  }
  if (defined(obj["lead"])) {
    kids.push(el("p", [txt(str(obj["lead"]))]));
  }
  return comp("Flex", [bound("direction", "'column'"), bound("gap", "3")], kids);
};

const features: Handler = (value): UiNode => {
  const items = asArray(value);
  const cards = items.map((item): UiNode => {
    const obj = asRecord(item);
    const inner: UiNode[] = [];
    if (defined(obj["title"])) {
      inner.push(comp("CardHeader", [], [txt(str(obj["title"]))]));
    }
    if (defined(obj["body"])) {
      inner.push(comp("CardBody", [], [txt(str(obj["body"]))]));
    }
    return comp("Card", [], inner);
  });
  return comp("Grid", [bound("columns", "3"), bound("gap", "4")], cards);
};

const list: Handler = (value, entities): UiNode => {
  const obj = sliceObject(value);
  const slug = str(obj["of"]);
  requireEntity(slug, "list", entities);
  return comp(pascalCase(slug), sliceAttrs(obj), []);
};

const cards: Handler = (value, entities): UiNode => {
  const obj = sliceObject(value);
  const slug = str(obj["of"]);
  requireEntity(slug, "cards", entities);
  return comp(cardsComponentName(slug), sliceAttrs(obj), []);
};

const stats: Handler = (value, entities): UiNode => {
  const obj = asRecord(value);
  const of = str(obj["of"]);
  requireEntity(of, "stats", entities);
  return comp(statsComponentName(of, str(obj["by"])), [], []);
};

const board: Handler = (value, entities): UiNode => {
  const obj = asRecord(value);
  const of = str(obj["of"]);
  requireEntity(of, "board", entities);
  return comp(boardComponentName(of, str(obj["by"])), sliceAttrs(obj), []);
};

const timeline: Handler = (): UiNode => comp("VowTimeline", [], []);

const issues: Handler = (value): UiNode => comp(ISSUE_LAYOUTS[issueLayout(value)], [], []);

const events: Handler = (value): UiNode => comp(EVENT_LAYOUTS[eventLayout(value)], [], []);

const loop: Handler = (value): UiNode => comp(LOOP_LAYOUTS[loopLayout(value)], [], []);

const icon: Handler = (value): UiNode => {
  const obj = asRecord(value);
  return comp("Icon", [{ kind: "static", name: "name", value: str(obj["name"]) }], []);
};

const link: Handler = (value): UiNode => {
  const obj = asRecord(value);
  const children: UiNode[] = [];
  if (defined(obj["icon"])) {
    children.push(comp("Icon", [{ kind: "static", name: "name", value: str(obj["icon"]) }], []));
  }
  children.push(txt(str(obj["label"] ?? obj["to"])));
  return {
    attrs: [
      { kind: "static", name: "class", value: "vow-link" },
      { kind: "static", name: "href", value: str(obj["to"]) },
    ],
    children,
    kind: "element",
    tag: "a",
  };
};

/** The semantic + structural handlers keyed by their `## view` node type. */
const HANDLERS: Readonly<Record<string, Handler>> = {
  board,
  cards,
  events,
  features,
  hero,
  icon,
  issues,
  link,
  list,
  loop,
  stats,
  timeline,
};

/** A PascalCase primitive name as written in a `## view` (lower first char: `Card` -> `card`). */
function lowerFirst(name: string): string {
  return name.charAt(0).toLowerCase() + name.slice(1);
}

/**
 * The closed view-node vocabulary, as the `type` strings written in a `## view` — every name
 * `knownViewType` accepts. The single enumeration the `add_view` tool description + `studio_info`
 * publish so the LLM sees the node names up front (semantic blocks, layout + UI primitives, text tags).
 */
export const VIEW_NODE_TYPES: readonly string[] = [
  ...Object.keys(HANDLERS),
  ...LAYOUT_PRIMITIVES.map((name) => lowerFirst(name)),
  ...PRIMITIVES.map((name) => lowerFirst(name)),
  ...TEXT_TAGS,
  "text",
].toSorted();

/** Whether `type` names a layout primitive or a UI primitive (placed directly in a view). */
function isPrimitive(type: string): boolean {
  const pascal = pascalCase(type);
  return LAYOUT_PRIMITIVES.includes(pascal) || PRIMITIVES.includes(pascal);
}

/**
 * Whether `type` is a node `mapNode` can render — a semantic/structural handler, a primitive, a text
 * tag, or the bare `text` escape. The single acceptance predicate: `mapNode` and `add_view`'s pre-write
 * validation both gate on it, so a node that validates at the MCP seam is exactly one that renders.
 */
export function knownViewType(type: string): boolean {
  return defined(HANDLERS[type]) || isPrimitive(type) || TEXT_TAGS.has(type) || type === "text";
}

/**
 * Throw the canonical "unknown view component" error, listing the whole `VIEW_NODE_TYPES` vocabulary so a
 * typo'd/invented type points straight at the closed set. The single message the emitter (`textNode`) and
 * the `add_view`/`set_view` MCP seam (`requireKnownTypes`) share, so a node that fails at one fails the
 * same way at the other.
 */
export function assertKnownViewType(type: string): void {
  if (knownViewType(type)) {
    return;
  }
  throw new Error(
    `emit-view: unknown view component "${type}" — allowed: ${VIEW_NODE_TYPES.join(", ")}`,
  );
}

/** A plain text node — a text tag (`h1`/`p`/…) or the bare `text` escape; throws on an unknown type. */
function textNode(type: string, value: unknown): UiNode {
  if (type === "text") {
    return txt(str(value));
  }
  assertKnownViewType(type);
  return el(type, [txt(str(value))]);
}

/**
 * Map one component (`type` + raw `value`) to a UiNode. `entities` are the entity slugs a `list:`
 * may reference. Semantic blocks expand into primitive trees; primitives/text tags/`text` are the
 * escape hatch. Self-recursive: a primitive's `children` map back through `mapNode`.
 */
export function mapNode(type: string, value: unknown, entities: readonly string[]): UiNode {
  const handler = HANDLERS[type];
  if (defined(handler)) {
    return handler(value, entities);
  }
  if (isPrimitive(type)) {
    const obj = asRecord(value);
    const attrs: Attr[] = propsToAttrs(obj);
    const kids = childrenOf(obj, (raw) => {
      const child = asRecord(raw);
      const [childType = ""] = Object.keys(child);
      return mapNode(childType, child[childType], entities);
    });
    return comp(pascalCase(type), attrs, kids);
  }
  return textNode(type, value);
}

/** The slice-bearing handlers — they emit a `:filter="{ ... }"` whose keys land in expression position. */
const SLICE_TYPES: ReadonlySet<string> = new Set(["board", "cards", "list"]);

/** A single `## view` node — the `{ type, value }` shape both the emitter and the MCP seam validate. */
interface RawNode {
  readonly type: string;
  readonly value: unknown;
}

/** Validate one node's filter keys (object-literal keys) — the slice sink (`:filter="{ key: ... }"`). */
function requireSafeFilterKeys(value: unknown): void {
  const { filter } = asRecord(value);
  if (defined(filter)) {
    for (const key of Object.keys(asRecord(filter))) {
      assertObjectKey(key);
    }
  }
}

/** The `{ type, value }` of one raw child of a primitive node (its single key + that key's value). */
function childNode(raw: unknown): RawNode {
  const child = asRecord(raw);
  const [type = ""] = Object.keys(child);
  return { type, value: child[type] };
}

/** Validate one primitive node's prop names (attribute names), then recurse into its `children`. */
function requireSafePrimitiveNames(value: unknown, recurse: (node: RawNode) => void): void {
  const obj = asRecord(value);
  for (const name of Object.keys(obj)) {
    if (name !== "children" && name !== "model") {
      assertAttrName(name);
    }
  }
  const kids = obj["children"];
  if (Array.isArray(kids)) {
    for (const kid of kids) {
      recurse(childNode(kid));
    }
  }
}

/** Validate one view node's emitted identifiers — the slice filter keys (object keys) and the primitive
 *  prop names (attribute names), recursing into a primitive's children through `requireSafeNode`. */
function requireSafeNode(node: RawNode): void {
  if (SLICE_TYPES.has(node.type)) {
    requireSafeFilterKeys(node.value);
  }
  if (isPrimitive(node.type)) {
    requireSafePrimitiveNames(node.value, requireSafeNode);
  }
}

/**
 * Validate every emitted identifier in a `## view` against the safe shapes BEFORE it is written — the
 * same guards the emitter applies (`assertObjectKey` on filter keys, `assertAttrName` on prop names), so
 * the `add_view` MCP seam rejects a breakout key synchronously rather than at the next `vp dev`/build.
 */
export function requireSafeNames(view: readonly RawNode[]): void {
  for (const node of view) {
    requireSafeNode(node);
  }
}

/** The direct children of a node that can themselves hold components (element/component/slot). */
function childNodes(node: UiNode): readonly UiNode[] {
  if (node.kind === "element" || node.kind === "component" || node.kind === "slot") {
    return node.children;
  }
  return [];
}

/** Collect every `<Component>` name in a UiNode tree (for imports) — one accumulator, walked once (no
 *  per-node Set allocation + upward re-merge). */
export function componentsIn(node: UiNode): Set<string> {
  const found = new Set<string>();
  const walk = (current: UiNode): void => {
    if (current.kind === "component") {
      found.add(current.name);
    }
    for (const child of childNodes(current)) {
      walk(child);
    }
  };
  walk(node);
  return found;
}
