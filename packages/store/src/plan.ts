import type { BlockedRef, PlanItem, PlanOrigin, PlanSnapshot, PlanStatus } from "@vow/plan";
import { asNumber, asString, isObject, toStringArray } from "./guards.ts";
import { hasApi, okJson } from "./net.ts";
import { VOW_API } from "@vow/db/routes";
import { reactive } from "vue";

/**
 * The local-plan concern of `@vow/store` — the runtime parser that turns a `/__vow/plan` JSON response
 * into a validated `PlanSnapshot`. The shape is `@vow/plan`'s own `PlanSnapshot` (the producer of the
 * wire), imported type-only — a `type` import is erased, so it stays a downward L2 -> L0 edge with no node
 * code in the browser bundle, yet a drift in the producer's shape now fails this parser's typecheck.
 * Read-only: the plan is driven by the MCP / agent / loop, never the browser.
 */

/** Narrow a free-form status to a `PlanStatus` — an unknown value reads as `backlog`. */
function toStatus(value: unknown): PlanStatus {
  if (
    value === "blocked" ||
    value === "doing" ||
    value === "done" ||
    value === "parked" ||
    value === "ready" ||
    value === "review"
  ) {
    return value;
  }
  return "backlog";
}

/** Narrow a free-form origin to a `PlanOrigin` — an unknown value reads as `external`. */
function toOrigin(value: unknown): PlanOrigin {
  if (value === "internal" || value === "user") {
    return value;
  }
  return "external";
}

/** The optional `issue` binding as a single-element fragment (a number) or empty — the spread form keeps
 *  the absent case free of an `undefined` literal. */
function issueFrag(value: unknown): { issue?: number } {
  if (typeof value === "number") {
    return { issue: value };
  }
  return {};
}

/** The optional `pillar` as a single-element fragment or empty. */
function pillarFrag(value: unknown): { pillar?: string } {
  if (typeof value === "string") {
    return { pillar: value };
  }
  return {};
}

/** The optional `closedAt` timestamp as a single-element fragment or empty. */
function closedFrag(value: unknown): { closedAt?: string } {
  if (typeof value === "string") {
    return { closedAt: value };
  }
  return {};
}

/** A parsed value as a list (or empty when it is not an array) — the array twin of the scalar guards. */
function asArray(value: unknown): readonly unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  return [];
}

/** Shape one parsed entry into a single-element `PlanItem[]` (when it is an object) or empty — the list
 *  form lets the snapshot parser flat-map a malformed entry away without an `undefined` literal. */
function toItem(value: unknown): PlanItem[] {
  if (!isObject(value)) {
    return [];
  }
  return [
    {
      createdAt: asString(value["createdAt"], ""),
      id: asString(value["id"], ""),
      origin: toOrigin(value["origin"]),
      position: asNumber(value["position"]),
      priority: asNumber(value["priority"]),
      status: toStatus(value["status"]),
      title: asString(value["title"], ""),
      updatedAt: asString(value["updatedAt"], ""),
      ...issueFrag(value["issue"]),
      ...pillarFrag(value["pillar"]),
      ...closedFrag(value["closedAt"]),
    },
  ];
}

/** Shape one parsed entry into a single-element `BlockedRef[]` (a string id + its blocker ids) or empty. */
function toBlocked(value: unknown): BlockedRef[] {
  if (!isObject(value)) {
    return [];
  }
  const id = asString(value["id"], "");
  if (id === "") {
    return [];
  }
  return [{ blockers: toStringArray(value["blockers"]), id }];
}

/** Turn a `/__vow/plan` response into a validated `PlanSnapshot` — items + the ready-queue ids + the
 *  blocked set. A non-object (or any malformed field) degrades to the empty plan, never throws. */
export function parsePlanSnapshot(value: unknown): PlanSnapshot {
  if (!isObject(value)) {
    return { blocked: [], items: [], ready: [] };
  }
  return {
    blocked: asArray(value["blocked"]).flatMap((entry) => toBlocked(entry)),
    items: asArray(value["items"]).flatMap((entry) => toItem(entry)),
    ready: toStringArray(value["ready"]),
  };
}

/** The shared reactive local plan — three arrays the studio's plan views bind to (the items, the
 *  ready-queue ids, the blocked set), spliced in place so their reactive identity stays stable. */
export const planItems = reactive<PlanItem[]>([]) as PlanItem[];
export const planReady = reactive<string[]>([]) as string[];
export const planBlocked = reactive<BlockedRef[]>([]) as BlockedRef[];

/** The fetch state the plan views read to distinguish loading / failed / empty. */
export const planState = reactive({ error: false, loading: false });

/** Replace the three shared arrays in place from a fresh snapshot — one stable identity per array. */
function replacePlan(snap: PlanSnapshot): void {
  planItems.splice(0, planItems.length, ...snap.items);
  planReady.splice(0, planReady.length, ...snap.ready);
  planBlocked.splice(0, planBlocked.length, ...snap.blocked);
}

/** Pull the local plan from `/__vow/plan` and replace the shared arrays, driving `planState` so the views
 *  can show a loading / error / empty branch. Read-only — the plan is driven by the MCP / agent / loop. */
export async function loadPlan(): Promise<void> {
  if (!hasApi) {
    return;
  }
  planState.loading = true;
  try {
    replacePlan(parsePlanSnapshot(await okJson(VOW_API.plan)));
    planState.error = false;
  } catch {
    planState.error = true;
  }
  planState.loading = false;
}
