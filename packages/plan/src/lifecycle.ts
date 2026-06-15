import type { PlanStatus } from "./types.ts";

/**
 * The status lifecycle — vow owns it, so every move is checked HERE, not derived from a GitHub label that
 * can orphan (the #623 class). `backlog → ready → doing → review → done`, with `blocked`/`parked` as side
 * states and `ready` from `doing` as a release (an agent giving the item back). `done` is terminal.
 */
const TRANSITIONS: Record<PlanStatus, readonly PlanStatus[]> = {
  backlog: ["ready", "parked"],
  blocked: ["ready", "parked"],
  doing: ["blocked", "ready", "review"],
  done: [],
  parked: ["backlog", "ready"],
  ready: ["blocked", "doing", "parked"],
  review: ["doing", "done", "parked"],
};

/** The legal next statuses from `from` — what a UI offers and the loop may set. */
export function nextStatuses(from: PlanStatus): readonly PlanStatus[] {
  return TRANSITIONS[from];
}

/** Whether `to` is a legal next status from `from` — the guard `setStatus` enforces. */
export function canTransition(from: PlanStatus, to: PlanStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Whether a status is terminal (no further transitions) — `done`. */
export function isTerminal(status: PlanStatus): boolean {
  return TRANSITIONS[status].length === 0;
}
