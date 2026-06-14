import type { EventItem } from "./events.ts";

/**
 * The active-agents concern of `@vow/store` — a pure derivation of which agent runs are currently
 * in flight, from the event feed. An issue is "active" from its `run.started` event until its
 * matching `run.finished`, with the latest `run.phase` shown as the current step and `agent.tool`
 * events surfacing the live tool-use feed (the sibling issue that emits `agent.tool` adds that depth).
 * Pure + exported so `VowAgentPanel`'s cockpit card is unit-testable without a live store or DOM.
 */

/** One tool-call from the live agent-tool feed — the tool name + its short summary. */
export interface ActiveTool {
  readonly name: string;
  readonly summary: string;
  readonly ts: string;
}

/** One actively-running agent — an issue with `run.started` and no matching `run.finished`,
 *  with the latest observed phase and all `agent.tool` events for that issue. */
export interface ActiveRun {
  readonly issue: number;
  readonly phase: string;
  readonly specialist: string;
  readonly tools: readonly ActiveTool[];
}

/** The four mutable maps that accumulate event state in one pass over the feed. */
interface RunMaps {
  finished: Set<number>;
  phases: Map<number, string>;
  specialists: Map<number, string>;
  toolsByIssue: Map<number, ActiveTool[]>;
}

/** The issue number from an event — 0 when the event carries no number (not an agent-scoped event). */
function issueOf(ev: Readonly<EventItem>): number {
  if (typeof ev.issue === "number") {
    return ev.issue;
  }
  return 0;
}

/** A string field that defaults to "" when absent. */
function strOr(value: string | undefined): string {
  if (typeof value === "string") {
    return value;
  }
  return "";
}

/** Apply a `run.started` event — resets all prior state so a re-run appears fresh. */
function applyStarted(maps: RunMaps, issue: number, ev: Readonly<EventItem>): void {
  maps.specialists.set(issue, strOr(ev.detail));
  maps.finished.delete(issue);
  maps.phases.delete(issue);
  maps.toolsByIssue.delete(issue);
}

/** Append one `agent.tool` event to the per-issue tool feed. */
function applyTool(maps: RunMaps, issue: number, ev: Readonly<EventItem>): void {
  const list = maps.toolsByIssue.get(issue) ?? [];
  list.push({ name: strOr(ev.phase), summary: strOr(ev.detail), ts: ev.ts });
  maps.toolsByIssue.set(issue, list);
}

/** Dispatch one event to the appropriate map update. */
function applyKind(maps: RunMaps, issue: number, ev: Readonly<EventItem>): void {
  if (ev.kind === "run.started") {
    applyStarted(maps, issue, ev);
  }
  if (ev.kind === "run.finished") {
    maps.finished.add(issue);
  }
  if (ev.kind === "run.phase") {
    maps.phases.set(issue, strOr(ev.phase));
  }
  if (ev.kind === "agent.tool") {
    applyTool(maps, issue, ev);
  }
}

/** Skip events with no issue field; dispatch the rest. */
function applyEvent(maps: RunMaps, ev: Readonly<EventItem>): void {
  const issue = issueOf(ev);
  if (issue !== 0) {
    applyKind(maps, issue, ev);
  }
}

/** Build the `ActiveRun[]` result from the accumulated maps. */
function collectActive(maps: RunMaps): ActiveRun[] {
  const active: ActiveRun[] = [];
  for (const [issue, specialist] of maps.specialists) {
    if (!maps.finished.has(issue)) {
      active.push({
        issue,
        phase: maps.phases.get(issue) ?? "",
        specialist,
        tools: maps.toolsByIssue.get(issue) ?? [],
      });
    }
  }
  return active;
}

/**
 * Derive the set of actively-running agents from an event feed — pure, so this is unit-testable
 * without a reactive store or a live SSE connection. An issue is "active" when the feed holds a
 * `run.started` for it but NO `run.finished` at or after that start event. The events are assumed
 * to be in append order (oldest first); the latest `run.phase` per issue is the current step.
 */
export function activeRunsFrom(items: readonly Readonly<EventItem>[]): ActiveRun[] {
  const maps: RunMaps = {
    finished: new Set(),
    phases: new Map(),
    specialists: new Map(),
    toolsByIssue: new Map(),
  };
  for (const ev of items) {
    applyEvent(maps, ev);
  }
  return collectActive(maps);
}
