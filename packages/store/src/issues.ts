import { asNumber, asString, isObject, toStringArray } from "./guards.ts";

/**
 * The issue-plan concern of `@vow/store` — the read-only `IssueItem` shape (mirroring
 * `@vow/observability`'s `PlanItem`) plus the runtime parser that turns a `/__vow/issues` JSON response
 * into a validated `IssueItem[]`. Kept separate from the row-collection store, and local to the browser
 * bundle so it pulls in no node code (GitHub is the single source; this view is read-only).
 */

/** One issue on the plan — mirrors `@vow/observability`'s `PlanItem` (the `/__vow/issues` shape). */
export interface IssueItem {
  readonly issue: {
    readonly assignees: readonly string[];
    readonly labels: readonly string[];
    readonly milestone?: { readonly title: string; readonly dueOn?: string };
    readonly number: number;
    readonly state: "open" | "closed";
    readonly title: string;
  };
  readonly status: "planned" | "doing" | "done";
}

type Milestone = NonNullable<IssueItem["issue"]["milestone"]>;

/** Narrow a free-form status to the plan's three states (anything else is treated as planned). */
function toStatus(value: unknown): IssueItem["status"] {
  if (value === "doing" || value === "done") {
    return value;
  }
  return "planned";
}

/** Narrow a free-form state to the issue's two states (anything but `"closed"` reads as open). */
function toState(value: unknown): IssueItem["issue"]["state"] {
  if (value === "closed") {
    return "closed";
  }
  return "open";
}

/** Shape a parsed milestone into a single-element list (when it is an object) or an empty one. The list
 *  form lets `toIssueShape` add the optional field by spreading — no `undefined` literal, no ternary. */
function toMilestoneList(value: unknown): Milestone[] {
  if (!isObject(value)) {
    return [];
  }
  const { dueOn } = value;
  const title = asString(value["title"], "");
  if (typeof dueOn === "string") {
    return [{ dueOn, title }];
  }
  return [{ title }];
}

/** Shape a parsed issue object into the read-only `IssueItem["issue"]`, defaulting any missing field. */
function toIssueShape(value: Readonly<Record<string, unknown>>): IssueItem["issue"] {
  const base = {
    assignees: toStringArray(value["assignees"]),
    labels: toStringArray(value["labels"]),
    number: asNumber(value["number"]),
    state: toState(value["state"]),
    title: asString(value["title"], ""),
  } as const;
  for (const milestone of toMilestoneList(value["milestone"])) {
    return { ...base, milestone };
  }
  return base;
}

/** Parse a `/__vow/issues` JSON value into a validated `IssueItem[]`, keeping only the well-formed entries
 *  (a status + an issue object) — so a malformed plan degrades to a clean, typed array. */
export function parseIssuePlan(value: unknown): IssueItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const list: readonly unknown[] = value;
  const out: IssueItem[] = [];
  for (const entry of list) {
    if (isObject(entry) && isObject(entry["issue"])) {
      out.push({ issue: toIssueShape(entry["issue"]), status: toStatus(entry["status"]) });
    }
  }
  return out;
}
