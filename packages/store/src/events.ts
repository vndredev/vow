import type { VowEvent } from "@vow/observability";
import { isObject } from "./guards.ts";

/**
 * The event-feed concern of `@vow/store` — the runtime parser that turns a `/__vow/events` JSON response
 * into a validated `EventItem[]`. The shape is `@vow/observability`'s `VowEvent` (the producer), imported
 * type-only so a drift in the producer's shape fails this parser's typecheck. Kept separate so the
 * collection store is not entangled with the read-only event feed.
 */

/** One event on the live feed — the `/__vow/events` wire shape, pinned to `@vow/observability`'s
 *  `VowEvent` (the producer). The optional fields are present only when the event carries them. */
export type EventItem = VowEvent;

/** A string field from a raw event object, or `""` when absent/non-string. */
function str(raw: Readonly<Record<string, unknown>>, key: string): string {
  const value = raw[key];
  if (typeof value === "string") {
    return value;
  }
  return "";
}

/** Shape the optional `issue` number — present only when the raw line carried a number. */
function issueField(raw: Readonly<Record<string, unknown>>): { issue?: number } {
  const value = raw["issue"];
  if (typeof value === "number") {
    return { issue: value };
  }
  return {};
}

/** Shape the optional `pr` number — present only when the raw line carried a number. */
function prField(raw: Readonly<Record<string, unknown>>): { pr?: number } {
  const value = raw["pr"];
  if (typeof value === "number") {
    return { pr: value };
  }
  return {};
}

/** Shape the optional `phase` string — present only when the raw line carried a string. */
function phaseField(raw: Readonly<Record<string, unknown>>): { phase?: string } {
  const value = raw["phase"];
  if (typeof value === "string") {
    return { phase: value };
  }
  return {};
}

/** Shape the optional `detail` string — present only when the raw line carried a string. */
function detailField(raw: Readonly<Record<string, unknown>>): { detail?: string } {
  const value = raw["detail"];
  if (typeof value === "string") {
    return { detail: value };
  }
  return {};
}

/** Lift one parsed object into an `EventItem`, omitting any absent optional. */
function liftEvent(raw: Readonly<Record<string, unknown>>): EventItem {
  return {
    kind: str(raw, "kind"),
    ts: str(raw, "ts"),
    ...issueField(raw),
    ...prField(raw),
    ...phaseField(raw),
    ...detailField(raw),
  };
}

/** Parse a `/__vow/events` JSON value into a validated `EventItem[]`, keeping only the well-formed
 *  entries (a non-empty `kind` + `ts`) — so a malformed feed degrades to a clean, typed array. */
export function parseEventFeed(value: unknown): EventItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const list: readonly unknown[] = value;
  const out: EventItem[] = [];
  for (const entry of list) {
    if (isObject(entry) && typeof entry["kind"] === "string" && typeof entry["ts"] === "string") {
      out.push(liftEvent(entry));
    }
  }
  return out;
}
