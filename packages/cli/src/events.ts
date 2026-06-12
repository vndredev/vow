/* oxlint-disable consistent-type-specifier-style -- one @vow/observability import; a separate type import trips no-duplicate-imports */
import { type VowEvent, readEvents } from "@vow/observability";
/* oxlint-enable consistent-type-specifier-style */
import { repoRoot } from "./apps.ts";

/**
 * `vow events` — print the realtime-observability trace: the events the hub recorded (the agent loop's runs
 * + phases, the merges), most recent last. The human/quick view of the live feed `@vow/observability`'s
 * event stream writes; the studio renders the same stream as a live panel, and the orchestrator tails the
 * log (`.vow/events.jsonl`) to react to observed state (#497).
 */

// How many trailing events `vow events` prints by default — the recent trace, not the whole history.
const DEFAULT_TAIL = 50;

/** The context pieces an event carries — the ids / phase / detail, in trace order, absent ones dropped. */
function contextParts(event: Readonly<VowEvent>): string[] {
  const parts: string[] = [];
  if (typeof event.issue === "number") {
    parts.push(`#${event.issue}`);
  }
  if (typeof event.pr === "number") {
    parts.push(`pr#${event.pr}`);
  }
  if (typeof event.phase === "string") {
    parts.push(event.phase);
  }
  if (typeof event.detail === "string") {
    parts.push(event.detail);
  }
  return parts;
}

/** The context suffix for a trace line — the pieces ` · `-joined, or "" when the event carries none. */
export function eventContext(event: Readonly<VowEvent>): string {
  const parts = contextParts(event);
  if (parts.length === 0) {
    return "";
  }
  return `  ${parts.join(" · ")}`;
}

/** Format one event as a trace line: `<ts>  <kind>  <context>`. Pure, so the line shape is unit-testable. */
export function formatEvent(event: Readonly<VowEvent>): string {
  return `${event.ts}  ${event.kind}${eventContext(event)}`;
}

/** `vow events` — print the recorded trace (the most recent events), most recent last. */
export function runEvents(): number {
  const recent = readEvents(repoRoot()).slice(-DEFAULT_TAIL);
  for (const event of recent) {
    process.stdout.write(`${formatEvent(event)}\n`);
  }
  return 0;
}
