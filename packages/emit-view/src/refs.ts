import type { IssueLayout, ReadonlyVow } from "./types.ts";
import { asObject, str } from "./helpers.ts";
import { defined } from "@vow/core";
import { issueLayout } from "./issue-layout.ts";

/** A reference to a by-field composition (`stats`/`board`) — the entity slug + the select field. */
export interface FieldRef {
  readonly of: string;
  readonly by: string;
}

/** Visit every (`type`, `value`) node in a `## view`, recursing through primitive `children`. */
function walkNodes(view: ReadonlyVow, visit: (type: string, value: unknown) => void): void {
  const descend = (type: string, value: unknown): void => {
    visit(type, value);
    const kids = asObject(value)["children"];
    if (!Array.isArray(kids)) {
      return;
    }
    for (const kid of kids) {
      const obj = asObject(kid);
      const [key] = Object.keys(obj);
      if (defined(key)) {
        descend(key, obj[key]);
      }
    }
  };
  for (const node of view.view ?? []) {
    descend(node.type, node.value);
  }
}

/** A scalar (`task`) or `{ of }` entity slug. */
function ofSlug(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  return str(asObject(value)["of"]);
}

/** Every entity slug a node of `kind` references via its `of` (scalar or `{ of }`). */
function slugsFor(view: ReadonlyVow, kind: string): string[] {
  const found = new Set<string>();
  walkNodes(view, (type, value) => {
    if (type === kind) {
      found.add(ofSlug(value));
    }
  });
  return [...found];
}

/** Every `{ of, by }` field-ref a node of `kind` makes, de-duplicated by `of.by`. */
function fieldRefsFor(view: ReadonlyVow, kind: string): FieldRef[] {
  const found: FieldRef[] = [];
  const seen = new Set<string>();
  walkNodes(view, (type, value) => {
    if (type !== kind) {
      return;
    }
    const obj = asObject(value);
    const ref: FieldRef = { by: str(obj["by"]), of: str(obj["of"]) };
    const key = `${ref.of}.${ref.by}`;
    if (!seen.has(key)) {
      seen.add(key);
      found.push(ref);
    }
  });
  return found;
}

/**
 * Every entity slug a view references via `list:` — recursing into primitive `children`. The plugin
 * uses this to emit each referenced entity's list on demand (the entity itself stays a pure model).
 */
export function listedEntities(view: ReadonlyVow): string[] {
  return slugsFor(view, "list");
}

/** The `cards: <entity>` references a `## view` makes — so the plugin can emit each composition. */
export function cardsRefs(view: ReadonlyVow): string[] {
  return slugsFor(view, "cards");
}

/** The `stats: { of, by }` references a `## view` makes — so the plugin can emit each composition. */
export function statsRefs(view: ReadonlyVow): FieldRef[] {
  return fieldRefsFor(view, "stats");
}

/** The `board: { of, by }` references a `## view` makes — so the plugin can emit each composition. */
export function boardRefs(view: ReadonlyVow): FieldRef[] {
  return fieldRefsFor(view, "board");
}

/** Whether a `## view` (recursively) renders a node of `type`. */
function usesNode(view: ReadonlyVow, type: string): boolean {
  let found = false;
  walkNodes(view, (nodeType) => {
    if (nodeType === type) {
      found = true;
    }
  });
  return found;
}

/** Whether a `## view` renders the git-derived `timeline:` — so the plugin materialises VowTimeline. */
export function usesTimeline(view: ReadonlyVow): boolean {
  return usesNode(view, "timeline");
}

/**
 * The issue-plan layouts a `## view` renders — so the plugin materialises the matching VowIssue*
 * components. Validated, so the set only ever holds real layouts.
 */
export function issueLayouts(view: ReadonlyVow): Set<IssueLayout> {
  const found = new Set<IssueLayout>();
  walkNodes(view, (type, value) => {
    if (type === "issues") {
      found.add(issueLayout(value));
    }
  });
  return found;
}
