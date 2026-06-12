import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * The realtime-observability event stream — vow's live activity feed. Operations (the agent loop, the hub,
 * the CLI) RECORD events to an append-only NDJSON log (`.vow/events.jsonl`); consumers READ/tail it: the
 * orchestrator agent reacts to observed state, the studio renders the trace + on/off. Local-first, the
 * channel everything watches (#497). Writes are best-effort — a logging hiccup never breaks the operation
 * it observes; parsing is graceful — a malformed line is skipped, never a thrown read.
 */

/** The append-only event log, under the repo's `.vow/` dir (beside the studio's `data.db`). */
const EVENTS_FILE = "events.jsonl";

/** One point on the live feed. `kind` is the event type (a string, so producers extend it without a core
    change); the optional ids/phase/detail carry the context the trace + the orchestrator read. */
export interface VowEvent {
  // ISO-8601 UTC, stamped at record time.
  readonly ts: string;
  // The event type — see KNOWN_EVENT_KINDS for the vocabulary the hub records today.
  readonly kind: string;
  // The issue in play (a develop run, a finding).
  readonly issue?: number;
  // The PR in play (a merge, a gate result).
  readonly pr?: number;
  // The run phase (worktree / develop / gates / publish), for `run.phase`.
  readonly phase?: string;
  // Free-text context (a verdict, a finding title, an error).
  readonly detail?: string;
}

/** The event kinds the hub records today — documented so the trace + the orchestrator share a vocabulary;
    producers may add more (the `kind` field is an open string). */
export const KNOWN_EVENT_KINDS: readonly string[] = [
  "run.started",
  "run.phase",
  "run.finished",
  "pr.merged",
];

/** The context fields a producer supplies — everything but the `ts`/`kind` the recorder stamps. */
export type EventFields = Omit<VowEvent, "kind" | "ts">;

/** The path to the event log under `cwd`'s `.vow/` dir. */
export function eventsPath(cwd: string): string {
  return path.join(cwd, ".vow", EVENTS_FILE);
}

/** Append one event to the log, creating `.vow/` if needed. BEST-EFFORT: returns whether it wrote, never
    throws — observing an operation must never break it. */
export function appendEvent(cwd: string, event: Readonly<VowEvent>): boolean {
  try {
    mkdirSync(path.join(cwd, ".vow"), { recursive: true });
    appendFileSync(eventsPath(cwd), `${JSON.stringify(event)}\n`);
    return true;
  } catch {
    return false;
  }
}

/** Record an event — stamp it with `ts` (now, UTC) + `kind`, then append. The producer-facing writer. */
export function recordEvent(
  cwd: string,
  kind: string,
  fields: Readonly<EventFields> = {},
): boolean {
  return appendEvent(cwd, { kind, ts: new Date().toISOString(), ...fields });
}

/** Whether a value is a non-null object — the entry to safely lift a parsed log line. */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** A string field of a raw line, or `""` when absent/non-string (the required `ts`/`kind`). */
function str(raw: Readonly<Record<string, unknown>>, key: string): string {
  const value = raw[key];
  if (typeof value === "string") {
    return value;
  }
  return "";
}

/** The optional `issue` field, present only when the raw line carried a number. */
function issueField(raw: Readonly<Record<string, unknown>>): { issue?: number } {
  const value = raw["issue"];
  if (typeof value === "number") {
    return { issue: value };
  }
  return {};
}

/** The optional `pr` field, present only when the raw line carried a number. */
function prField(raw: Readonly<Record<string, unknown>>): { pr?: number } {
  const value = raw["pr"];
  if (typeof value === "number") {
    return { pr: value };
  }
  return {};
}

/** The optional `phase` field, present only when the raw line carried a string. */
function phaseField(raw: Readonly<Record<string, unknown>>): { phase?: string } {
  const value = raw["phase"];
  if (typeof value === "string") {
    return { phase: value };
  }
  return {};
}

/** The optional `detail` field, present only when the raw line carried a string. */
function detailField(raw: Readonly<Record<string, unknown>>): { detail?: string } {
  const value = raw["detail"];
  if (typeof value === "string") {
    return { detail: value };
  }
  return {};
}

/** Lift one parsed log line into a `VowEvent`, omitting any absent optional — no cast, the strict-wall way. */
function liftEvent(raw: Readonly<Record<string, unknown>>): VowEvent {
  return {
    kind: str(raw, "kind"),
    ts: str(raw, "ts"),
    ...issueField(raw),
    ...prField(raw),
    ...phaseField(raw),
    ...detailField(raw),
  };
}

/** Parse one log line into 0 or 1 events — a malformed/non-object line yields `[]` (skipped), never a throw. */
function parseLine(line: string): VowEvent[] {
  try {
    const parsed: unknown = JSON.parse(line);
    if (isObject(parsed)) {
      return [liftEvent(parsed)];
    }
  } catch {
    return [];
  }
  return [];
}

/** Parse NDJSON event-log text into events — one object per non-empty line, a malformed line skipped (never
    a thrown read). Pure, so the stream's read path is unit-testable. */
export function parseEvents(text: string): VowEvent[] {
  return text
    .split("\n")
    .filter((line) => line.trim() !== "")
    .flatMap((line) => parseLine(line));
}

/** Read the recorded events under `cwd`, newest LAST (append order). `[]` when the log is absent/unreadable
    (no hub has run yet) — never throws. */
export function readEvents(cwd: string): VowEvent[] {
  try {
    return parseEvents(readFileSync(eventsPath(cwd), "utf8"));
  } catch {
    return [];
  }
}
