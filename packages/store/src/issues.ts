import type { GitHubIssue, IssueStatus, PlanItem } from "@vow/observability";
import { asNumber, asString, isObject, toStringArray } from "./guards.ts";

/**
 * The issue-plan concern of `@vow/store` — the runtime parser that turns a `/__vow/issues` JSON response
 * into a validated `IssueItem[]`. The shape is `@vow/observability`'s `PlanItem` itself (the producer of
 * the wire), imported type-only — a `type` import is erased, so it stays a downward L2 -> L0 edge with no
 * node code in the browser bundle, yet a drift in the producer's shape now fails this parser's typecheck.
 * Kept separate from the row-collection store (GitHub is the single source; this view is read-only).
 */

/** One issue on the plan — the `/__vow/issues` wire shape, pinned to `@vow/observability`'s `PlanItem` (the
 *  producer). The `session` is the open PR redeeming a `doing` issue — the link the human watches the run at. */
export type IssueItem = PlanItem;

type Milestone = NonNullable<GitHubIssue["milestone"]>;
type Session = NonNullable<PlanItem["session"]>;

/** Narrow a free-form status to the plan's three states (anything else is treated as planned). */
function toStatus(value: unknown): IssueStatus {
  if (value === "doing" || value === "done") {
    return value;
  }
  return "planned";
}

/** Narrow a free-form state to the issue's two states (anything but `"closed"` reads as open). */
function toState(value: unknown): GitHubIssue["state"] {
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

/** Shape a parsed session into a single-element list (when it is an object with a numeric `number` and a
 *  string `url`) or an empty one — so a `doing` item carries the link and a malformed one simply omits it.
 *  The list form lets `parseIssuePlan` add the optional field by spreading — no `undefined` literal. */
function toSessionList(value: unknown): Session[] {
  if (!isObject(value)) {
    return [];
  }
  const { number, url } = value;
  if (typeof number === "number" && typeof url === "string") {
    return [{ number, url }];
  }
  return [];
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

/** Add the optional `session` to a base item by spreading the single-element list `toSessionList` returns
 *  (a valid session) or the empty one (none) — keeping the caller free of an `undefined` literal. */
function withSession(base: Omit<IssueItem, "session">, value: unknown): IssueItem[] {
  for (const session of toSessionList(value)) {
    return [{ ...base, session }];
  }
  return [base];
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
      const base = {
        issue: toIssueShape(entry["issue"]),
        status: toStatus(entry["status"]),
      } as const;
      out.push(...withSession(base, entry["session"]));
    }
  }
  return out;
}
