import type { Attr, UiNode } from "./types.ts";
import { ISSUE_LAYOUTS, issueLayout } from "./issue-layout.ts";
import { asObject, bound, comp, el, str, txt } from "./helpers.ts";
import { boardComponentName, cardsComponentName, statsComponentName } from "./naming.ts";
import { childrenOf, propsToAttrs, sliceAttrs } from "./slice.ts";
import { LAYOUT_PRIMITIVES } from "@vow/layout";
import { PRIMITIVE_ADAPTERS } from "@vow/emit-primitive";
import { defined } from "@vow/core";
import { pascalCase } from "@vow/component";

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
  return asObject(value);
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
  const obj = asObject(value);
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
    const obj = asObject(item);
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
  const obj = asObject(value);
  const of = str(obj["of"]);
  requireEntity(of, "stats", entities);
  return comp(statsComponentName(of, str(obj["by"])), [], []);
};

const board: Handler = (value, entities): UiNode => {
  const obj = asObject(value);
  const of = str(obj["of"]);
  requireEntity(of, "board", entities);
  return comp(boardComponentName(of, str(obj["by"])), sliceAttrs(obj), []);
};

const timeline: Handler = (): UiNode => comp("VowTimeline", [], []);

const issues: Handler = (value): UiNode => comp(ISSUE_LAYOUTS[issueLayout(value)], [], []);

const icon: Handler = (value): UiNode => {
  const obj = asObject(value);
  return comp("Icon", [{ kind: "static", name: "name", value: str(obj["name"]) }], []);
};

const link: Handler = (value): UiNode => {
  const obj = asObject(value);
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
  features,
  hero,
  icon,
  issues,
  link,
  list,
  stats,
  timeline,
};

/** Whether `type` names a layout primitive or a UI primitive (placed directly in a view). */
function isPrimitive(type: string): boolean {
  const pascal = pascalCase(type);
  return LAYOUT_PRIMITIVES.includes(pascal) || PRIMITIVES.includes(pascal);
}

/** A plain text node — a text tag (`h1`/`p`/…) or the bare `text` escape; throws on an unknown type. */
function textNode(type: string, value: unknown): UiNode {
  if (TEXT_TAGS.has(type)) {
    return el(type, [txt(str(value))]);
  }
  if (type === "text") {
    return txt(str(value));
  }
  throw new Error(`emit-view: unknown view component "${type}"`);
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
    const obj = asObject(value);
    const attrs: Attr[] = propsToAttrs(obj);
    const kids = childrenOf(obj, (raw) => {
      const child = asObject(raw);
      const [childType = ""] = Object.keys(child);
      return mapNode(childType, child[childType], entities);
    });
    return comp(pascalCase(type), attrs, kids);
  }
  return textNode(type, value);
}

/** Map a raw single-key YAML node (`{ flex: {...} }`) to a UiNode. */
export function rawToUiNode(raw: unknown, entities: readonly string[]): UiNode {
  const obj = asObject(raw);
  const type = Object.keys(obj)[0] ?? "";
  return mapNode(type, obj[type], entities);
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
