/* oxlint-disable consistent-type-specifier-style -- one import; a separate type import trips no-duplicate-imports */
import { type Collection, type CollectionState, ReactiveRows, type Row } from "./reactive-rows.ts";
import { LOOP_STATUS_IDLE, type LoopStatusItem, parseLoopStatus } from "./loop-status.ts";
import { type McpStatusItem, loadMcpStatus, mcpStatus, mcpStatusState } from "./mcp-status.ts";
/* oxlint-enable consistent-type-specifier-style */
import { VOW_API, dbPath } from "@vow/db/routes";
import { detach, hasApi, okJson } from "./net.ts";
import { loadPlan, planBlocked, planItems, planReady, planState } from "./plan.ts";
import { isObject } from "./guards.ts";
import { parseEventFeed } from "./events.ts";
import { reactive } from "vue";

export type { Collection, CollectionState, LoopStatusItem, McpStatusItem };
export { ReactiveRows };

/**
 * @vow/store — the data adapter the generated views bind to. `useCollection(slug)` returns ONE shared
 * reactive array per entity slug (so a `reference` field reads another entity's items — the relation
 * dropdown). The array is backed by the local SQLite DB through the dev API (`/__vow/db/<slug>`; a Worker
 * over D1 in prod): the store loads it on first use, mutations write through, and it refetches on focus +
 * a light interval so an out-of-band write (the MCP/agent) shows up. The `useCollection` seam is
 * unchanged — only what's behind it (it was pure in-memory). Outside a browser (SSR / jsdom) it degrades
 * to a plain in-memory array (fetch is a no-op), so non-DOM imports stay safe.
 *
 * The local-plan concern (the `PlanSnapshot` parser + its reactive arrays) lives in `./plan.ts`; shared
 * runtime guards live in `./guards.ts`.
 */

/** The validated event-feed item (the public `@vow/store` type generated views bind to), derived from the
 *  parser in `./events.ts` so the type tracks the runtime shape exactly. */
export type EventItem = ReturnType<typeof parseEventFeed>[number];

const REFRESH_INTERVAL_MS = 5000;

/** Validate one parsed JSON value into a single-element `Row[]` (when it has a string `id`) or an empty
 *  array (when it is not a row). Returning a list keeps the absent case free of an `undefined` literal. */
function toRowList(value: unknown): Row[] {
  if (isObject(value) && typeof value["id"] === "string") {
    return [{ ...value, id: value["id"] }];
  }
  return [];
}

/** Validate a parsed JSON value into a `Row[]`, dropping anything without a string `id`. A real runtime
 *  check (not a blind cast), so a malformed dev-API response degrades to a clean, typed array. */
function toRows(value: unknown): Row[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const list: readonly unknown[] = value;
  const out: Row[] = [];
  for (const entry of list) {
    out.push(...toRowList(entry));
  }
  return out;
}

const collections = new Map<string, ReactiveRows>();

/** The outcome of one dev-API fetch — `ok` is false on a non-ok response or transport failure, so the
 *  caller latches a reactive `error` flag rather than swallow it (the old `[]` hid a failure as empty, so a
 *  failed fetch read as "Nothing here yet."). One shape for both the rows fetch and the event-feed fetch. */
interface FetchResult<T> {
  readonly items: readonly T[];
  readonly ok: boolean;
}

/** Read a slug's rows from the dev API, reporting `ok: false` (with no items) on any non-ok response or
 *  transport failure — so a failed fetch latches the error flag instead of reading as empty. */
async function fetchRows(slug: string): Promise<FetchResult<Row>> {
  try {
    return { items: toRows(await okJson(dbPath(slug))), ok: true };
  } catch {
    return { items: [], ok: false };
  }
}

/** Pull a slug's rows from the dev API into its collection (a no-op outside a browser / with no server, or
 *  when the slug has no live collection yet). Drives the collection's loading / error `state` around the
 *  fetch so the list can branch on it. Resolves the list from `collections` so no instance is passed in —
 *  the rule wall forbids a mutable class-instance parameter. */
async function load(slug: string): Promise<void> {
  const list = collections.get(slug);
  if (!hasApi || !list) {
    return;
  }
  list.state.loading = true;
  const result = await fetchRows(slug);
  list.state.error = !result.ok;
  list.state.loading = false;
  if (result.ok) {
    list.reconcile(result.items);
  }
}

type WriteMethod = "POST" | "PATCH" | "DELETE";

/** Fire-and-forget a write to a dev-API `url` (built by `dbPath`) — the optimistic local change already
 *  happened. Takes plain string params (not a `RequestInit`, which is not deeply readonly) so the rule wall
 *  holds; an absent `body` (the default) is a body-less request, e.g. a DELETE. */
async function write(url: string, method: WriteMethod, body = ""): Promise<void> {
  if (!hasApi) {
    return;
  }
  const init: RequestInit = { headers: { "content-type": "application/json" }, method };
  if (body) {
    init.body = body;
  }
  try {
    await fetch(url, init);
  } catch {
    // Optimistic: the local change already happened; a failed write-through is swallowed.
  }
}

/** Whether the plan hook has kicked off its first fetch — the loaded-flag the freshness poll reads. The
 *  plan's reactive arrays + loader live in `./plan.ts` (the concern module); this owns only the hook. */
let planLoaded = false;

const events = reactive<EventItem[]>([]) as EventItem[];
let eventsLoaded = false;

/** The fetch state the event trace reads to distinguish loading / failed / genuinely-empty. Parallel to
 *  `planState`; `loading` is on while a fetch is in flight, `error` latches on a non-ok response. */
const eventsState = reactive({ error: false, loading: false });

/** True once a live SSE connection has been established at least once — once realtime is delivering, the
 *  poll stays a silent reconciler (it never flips the error flag back on while the stream is up). */
let eventStreamLive = false;

/** The shared reactive agent-loop status — one object the studio binds to, replaced field-by-field on each
 *  poll so Vue tracks the change. Starts idle (`running: false`) until the first fetch lands. */
const loopStatus = reactive<LoopStatusItem>({ ...LOOP_STATUS_IDLE });
let loopStatusLoaded = false;

/** The fetch state the loop-status view reads to distinguish loading / failed. Parallel to `planState`;
 *  `loading` is on while a fetch is in flight, `error` latches on a non-ok response. */
const loopStatusState = reactive({ error: false, loading: false });

let mcpStatusLoaded = false;

/** Pull the agent-loop status from `/__vow/agent-loop/status` and copy it into the shared reactive object,
 *  driving `loopStatusState` so the view can show a loading / error branch. Copies field-by-field (not a
 *  replace) so the reactive identity callers hold stays stable. */
async function loadLoopStatus(): Promise<void> {
  if (!hasApi) {
    return;
  }
  loopStatusState.loading = true;
  try {
    const status = parseLoopStatus(await okJson(VOW_API.agentLoop));
    Object.assign(loopStatus, LOOP_STATUS_IDLE, status);
    loopStatusState.error = false;
  } catch {
    loopStatusState.error = true;
  }
  loopStatusState.loading = false;
}

/** Read the event feed from `/__vow/events`, reporting `ok: false` on any non-ok response or failure. */
async function fetchEvents(): Promise<FetchResult<EventItem>> {
  try {
    return { items: parseEventFeed(await okJson(VOW_API.events)), ok: true };
  } catch {
    return { items: [], ok: false };
  }
}

/** A stable identity for one feed event — the append-only log has no id, so the realtime push and the poll
 *  reconcile against the same `ts`+`kind`+context key, never duplicating an event both paths saw. Pure +
 *  exported so the dedup is unit-testable without a DOM. */
export function eventKey(event: Readonly<EventItem>): string {
  return JSON.stringify([event.ts, event.kind, event.issue, event.pr, event.phase, event.detail]);
}

/** Merge a realtime-pushed event into a feed by identity: the events to APPEND — `[event]` when its key is
 *  new, `[]` when the feed (loaded by a poll, or an SSE backlog replay) already holds it. Never drops, never
 *  duplicates. Pure + exported so the realtime invariant is unit-testable without an `EventSource`. */
export function mergeEvent(
  feed: readonly Readonly<EventItem>[],
  event: Readonly<EventItem>,
): EventItem[] {
  const seen = new Set(feed.map((entry) => eventKey(entry)));
  if (seen.has(eventKey(event))) {
    return [];
  }
  return [event];
}

/** Append a realtime-pushed event to the shared feed only when it is new (`mergeEvent`) — the SSE stream
 *  replays the backlog on connect and the poll fallback may have already loaded it, so a seen key is a
 *  no-op. Clears the error/loading flags since a live push means the channel is up. */
function appendEvent(event: Readonly<EventItem>): void {
  for (const fresh of mergeEvent(events, event)) {
    eventsState.error = false;
    eventsState.loading = false;
    events.push(fresh);
  }
}

/** Pull the event feed from `/__vow/events` and replace the shared array, driving `eventsState` so the
 *  trace can show a loading / error / empty branch. The realtime SSE path (`subscribeEvents`) is the live
 *  channel; this poll is the fallback that still reconciles the whole feed when SSE is unavailable. */
async function loadEvents(): Promise<void> {
  if (!hasApi) {
    return;
  }
  eventsState.loading = true;
  const result = await fetchEvents();
  // While the live SSE channel is delivering, a transient poll failure must not blank the fresh trace.
  eventsState.error = !result.ok && !eventStreamLive;
  eventsState.loading = false;
  if (result.ok) {
    events.splice(0, events.length, ...result.items);
  }
}

/** Whether the browser exposes `EventSource` — the realtime channel degrades to the 5s poll without it
 *  (an SSR/jsdom env, or a dev server that answers `/__vow/events` only as a JSON snapshot). */
const hasEventSource = hasApi && "EventSource" in globalThis;

/** Parse one SSE `data:` frame into 0 or 1 events — a malformed frame is skipped (never a thrown handler).
 *  Exported so the wire-parse is unit-testable without a live stream. */
export function parseEventFrame(data: string): EventItem[] {
  try {
    return parseEventFeed([JSON.parse(data)]);
  } catch {
    return [];
  }
}

/** The minimal, deeply-readonly shape of the SSE `message` event this subscriber reads — only `data` (the
 *  raw frame text). Every `MessageEvent` satisfies it, so the listener passes its event straight through
 *  without tripping the strict `prefer-readonly-parameter-types` rule on the library type. */
interface EventMessage {
  readonly data: unknown;
}

/** Append the events one SSE `message` frame carries — typed by the minimal readonly `EventMessage`. */
function onEventMessage(event: EventMessage): void {
  if (typeof event.data === "string") {
    for (const item of parseEventFrame(event.data)) {
      appendEvent(item);
    }
  }
}

/** Subscribe to the live event stream over `/__vow/events` (an `EventSource`, `Accept: text/event-stream`):
 *  each recorded event is PUSHED instantly and appended (deduped), so the trace updates in true realtime
 *  rather than within the 5s poll. The browser auto-reconnects on a dropped connection; the poll stays the
 *  always-on fallback, so a dev server that serves only the JSON snapshot (no SSE) still refreshes. A no-op
 *  without `EventSource` (SSR/jsdom) — the poll alone covers that env. */
function subscribeEvents(): void {
  if (!hasEventSource) {
    return;
  }
  const source = new EventSource(VOW_API.events);
  source.addEventListener("open", () => {
    eventStreamLive = true;
    eventsState.error = false;
  });
  source.addEventListener("message", onEventMessage);
  source.addEventListener("error", () => {
    // A dropped connection: the browser auto-reconnects and the 5s poll covers the gap. Not latched as an
    // `error` here — a transient reconnect blip must not blank the trace the poll is still keeping fresh.
    eventStreamLive = false;
  });
}

let freshness = false;

function detachIfLoaded(loaded: boolean, loader: () => Promise<void>): void {
  if (loaded) {
    detach(loader);
  }
}

function refresh(): void {
  if (document.hidden) {
    return;
  }
  for (const slug of collections.keys()) {
    detach(async () => {
      await load(slug);
    });
  }
  detachIfLoaded(planLoaded, loadPlan);
  detachIfLoaded(eventsLoaded, loadEvents);
  detachIfLoaded(loopStatusLoaded, loadLoopStatus);
  detachIfLoaded(mcpStatusLoaded, loadMcpStatus);
}

/** Refetch every loaded collection on focus + a light visible-tab interval, so an MCP write shows up. */
function startFreshness(): void {
  if (freshness || !hasApi) {
    return;
  }
  freshness = true;
  globalThis.addEventListener("focus", refresh);
  document.addEventListener("visibilitychange", refresh);
  setInterval(refresh, REFRESH_INTERVAL_MS);
}

/** Resolve (creating on first use) the live reactive row list for a slug. On first creation it kicks off
 *  the slug's first load (which drives the collection's loading / error `state`) and starts the freshness
 *  poll — so registration in `collections` IS the "first fetch kicked off" mark (no parallel `loaded` set). */
function listFor(slug: string): ReactiveRows {
  const existing = collections.get(slug);
  if (existing) {
    return existing;
  }
  const created = new ReactiveRows();
  collections.set(slug, created);
  detach(async () => {
    await load(slug);
  });
  startFreshness();
  return created;
}

/** Present the store's internal rows to a caller as `T[]`. The store is intentionally heterogeneous
 *  (`Row`) while each view is typed by the caller's entity `T`; this is the one boundary where the live
 *  reactive array is re-viewed. The array identity is preserved (the very same reactive instance is
 *  returned), which the `reference` dropdowns and Vue's reactivity both rely on. The overload carries the
 *  typed view to callers while the implementation only widens to `unknown[]` — so there is no narrowing
 *  assertion; the store's dynamic boundary is expressed in the types, not punched through with a cast. */
function viewAs<T>(rows: readonly Readonly<Row>[]): T[];
function viewAs(rows: readonly Readonly<Row>[]): readonly unknown[] {
  return rows;
}

/** Run an optimistic write off the caller's path while the slug's collection marks `id` pending — so a
 *  freshness poll landing in this window skips the row (no flicker) — clearing the mark once the write
 *  settles, win or fail, so the next poll reconciles it normally. The collection is resolved from `slug`
 *  (a plain string), never passed in, so the rule wall against a mutable-instance parameter holds. */
function writeThrough(slug: string, id: string, send: () => Promise<void>): void {
  collections.get(slug)?.markPending(id);
  detach(async () => {
    try {
      await send();
    } finally {
      collections.get(slug)?.clearPending(id);
    }
  });
}

/** The shared reactive collection for an entity slug — same array for every caller; DB-backed. The first
 *  call creates the list (kicking off its load + the freshness poll via `listFor`); later calls reuse it. */
export function useCollection<T>(slug: string): Collection<T> {
  const list = listFor(slug);
  return {
    append: (item): void => {
      for (const row of toRowList(item)) {
        list.push(row);
        writeThrough(slug, row.id, async () => {
          await write(dbPath(slug), "POST", JSON.stringify(item));
        });
      }
    },
    items: viewAs<T>(list.rows),
    removeAt: (index): void => {
      const id = list.removeAt(index);
      if (typeof id === "string") {
        writeThrough(slug, id, async () => {
          await write(dbPath(slug, id), "DELETE");
        });
      }
    },
    removeById: (id): void => {
      const removed = list.removeById(id);
      if (typeof removed === "string") {
        writeThrough(slug, removed, async () => {
          await write(dbPath(slug, removed), "DELETE");
        });
      }
    },
    state: list.state,
    update: (id, patch): void => {
      list.update(id, patch);
      writeThrough(slug, id, async () => {
        await write(dbPath(slug, id), "PATCH", JSON.stringify(patch));
      });
    },
  };
}

/** The shared reactive local plan, read live from `/__vow/plan` (the local SQLite DAG `@vow/plan` owns).
 *  `items` is every plan item; `ready` the ordered ready-queue ids (the work the loop pulls next); `blocked`
 *  the ready items held by an unfinished dependency. Polled on focus + the interval like the others. `state`
 *  matches the `CollectionState` shape — its loading / error flags let a view show "Loading…" / "Couldn't
 *  load the plan". Read-only: the plan is driven by the MCP / agent / loop, never the browser. */
export function usePlan(): {
  blocked: typeof planBlocked;
  items: typeof planItems;
  ready: typeof planReady;
  state: CollectionState;
} {
  if (!planLoaded) {
    planLoaded = true;
    detach(loadPlan);
    startFreshness();
  }
  return { blocked: planBlocked, items: planItems, ready: planReady, state: planState };
}

/** The shared reactive event feed, read live from `/__vow/events`. It subscribes to the SSE stream (an
 *  `EventSource`) so each recorded event PUSHES into the trace instantly — true realtime, not within the 5s
 *  poll. The poll stays the always-on fallback (focus + interval) for when SSE is unavailable (an older dev
 *  server that serves only the JSON snapshot, SSR/jsdom). `state` matches the `CollectionState` shape — its
 *  loading / error flags let a view show "Loading…" or "Couldn't load events". Read-only: the feed is
 *  append-only and has no write seam in the browser. */
export function useEvents(): {
  items: EventItem[];
  state: CollectionState;
} {
  if (!eventsLoaded) {
    eventsLoaded = true;
    detach(loadEvents);
    subscribeEvents();
    startFreshness();
  }
  return { items: events, state: eventsState };
}

/** The shared reactive agent-loop status, read live from `/__vow/agent-loop/status` (the loop process records
 *  it to the repo-root `.vow/loop-status.json`; the dev server serves it). It exposes whether autonomy is on
 *  (`running`), the current `round`, the `backlog` + `openPrs` the round saw, and `lastRound` — so the studio
 *  shows whether the loop is on and what it is working through, polled on focus + the 5s interval like the
 *  others. `state` matches the `CollectionState` shape — its loading / error flags let a view show "Loading…"
 *  or "Couldn't reach the loop". Read-only: the status is produced by the loop, never the browser (the
 *  start/stop control half is a follow-up, #623). */
export function useAgentLoopStatus(): {
  status: LoopStatusItem;
  state: CollectionState;
} {
  if (!loopStatusLoaded) {
    loopStatusLoaded = true;
    detach(loadLoopStatus);
    startFreshness();
  }
  return { state: loopStatusState, status: loopStatus };
}

/** The shared reactive MCP/channel health status, read live from `/__vow/mcp/status`. It exposes whether
 *  the MCP/loop channel is connected (`connected`, derived from the freshness of the event feed — true when
 *  the newest event's `ts` is within the 5-minute window), the `toolCount` the vow MCP server registers, and
 *  the `lastEvent` from the feed (`ts` + `kind`). Polled on focus + the 5s interval like the other status
 *  surfaces. `state` matches the `CollectionState` shape — its loading / error flags let a view show
 *  "Loading…" or "Couldn't load the MCP status". Read-only: the status is derived, never written. */
export function useMcpStatus(): {
  status: McpStatusItem;
  state: CollectionState;
} {
  if (!mcpStatusLoaded) {
    mcpStatusLoaded = true;
    detach(loadMcpStatus);
    startFreshness();
  }
  return { state: mcpStatusState, status: mcpStatus };
}

/** Create a stand-alone reactive row list — the in-place reconciliation surface, exported for tests and
 *  any caller that needs the store's identity-preserving reconcile without a DB-backed collection. */
export function createList(): ReactiveRows {
  return new ReactiveRows();
}
