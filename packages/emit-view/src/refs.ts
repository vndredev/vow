import type { IssueLayout, ReadonlyVow } from "./types.ts";
import { asRecord, defined } from "@vow/core";
import { issueLayout } from "./issue-layout.ts";
import { str } from "./helpers.ts";

/** A reference to a by-field composition (`stats`/`board`) — the entity slug + the select field. */
export interface FieldRef {
  readonly of: string;
  readonly by: string;
}

/** Visit every (`type`, `value`) node in a `## view`, recursing through primitive `children`. */
function walkNodes(view: ReadonlyVow, visit: (type: string, value: unknown) => void): void {
  const descend = (type: string, value: unknown): void => {
    visit(type, value);
    const kids = asRecord(value)["children"];
    if (!Array.isArray(kids)) {
      return;
    }
    for (const kid of kids) {
      const obj = asRecord(kid);
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
  return str(asRecord(value)["of"]);
}

/** The opt-in row actions a `list:` node enables, e.g. `list: { of: task, actions: [delete] }` — only the
 *  recognised `delete` is honoured (the studio's read-only stance is the default). */
export interface ListRef {
  readonly of: string;
  readonly delete: boolean;
}

/** Whether a `list:` node's `actions:` (an array of action names) opts into the per-row delete button. */
function wantsDelete(value: unknown): boolean {
  const { actions } = asRecord(value);
  return Array.isArray(actions) && actions.includes("delete");
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
    const obj = asRecord(value);
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
 * Every entity a view references via `list:` — recursing into primitive `children` — de-duplicated by
 * slug, each carrying whether ANY of its `list:` nodes opted into the per-row delete action. The plugin
 * uses this to emit each referenced entity's list on demand (the entity itself stays a pure model).
 */
export function listedEntities(view: ReadonlyVow): ListRef[] {
  const byOf = new Map<string, ListRef>();
  walkNodes(view, (type, value) => {
    if (type !== "list") {
      return;
    }
    const of = ofSlug(value);
    const wants = wantsDelete(value) || (byOf.get(of)?.delete ?? false);
    byOf.set(of, { delete: wants, of });
  });
  return [...byOf.values()];
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
