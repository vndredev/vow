/**
 * `@vow/plan` — vow's local plan: a SQLite-backed DAG of work (items · deps · sessions · events), the
 * rich structure GitHub issues can't model. Content stays on a thin issue; structure lives here. Re-exported
 * by name (an explicit public API), the same discipline `@vow/db` keeps.
 */
export type { PlanDep, PlanEvent, PlanItem, PlanOrigin, PlanSession, PlanStatus } from "./types.ts";
export type { BlockedItem, Leverage } from "./queue.ts";
export type { PlanEventInput, PlanItemInput } from "./store.ts";
export { canTransition, isTerminal, nextStatuses } from "./lifecycle.ts";
export { openPlan, planDbPath } from "./location.ts";
export { blockedItems, readyQueue, unblocksMost } from "./queue.ts";
export { migratePlan } from "./schema.ts";
export {
  addDep,
  addItem,
  closeSession,
  getItem,
  getSession,
  listDeps,
  listEvents,
  listItems,
  listSessions,
  openSession,
  recordEvent,
  removeDep,
  removeItem,
  setPriority,
  setStatus,
} from "./store.ts";
