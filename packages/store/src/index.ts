/* oxlint-disable consistent-type-specifier-style -- one import; a separate type import trips no-duplicate-imports */
import { type Collection, type CollectionState, ReactiveRows, type Row } from "./reactive-rows.ts";
/* oxlint-enable consistent-type-specifier-style */
import { VOW_API, dbPath } from "@vow/db/routes";
import { isObject } from "./guards.ts";
import { parseEventFeed } from "./events.ts";
import { parseIssuePlan } from "./issues.ts";
import { reactive } from "vue";

export type { Collection, CollectionState };
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
 * The issue-plan concern (the `IssueItem` shape + its runtime parser) lives in `./issues.ts`; shared
 * runtime guards live in `./guards.ts`.
 */

/** The validated issue-plan item (the public `@vow/store` type generated views bind to), derived from the
 *  parser in `./issues.ts` so the type tracks the runtime shape exactly. */
export type IssueItem = ReturnType<typeof parseIssuePlan>[number];

/** The validated event-feed item (the public `@vow/store` type generated views bind to), derived from the
 *  parser in `./events.ts` so the type tracks the runtime shape exactly. */
export type EventItem = ReturnType<typeof parseEventFeed>[number];

const REFRESH_INTERVAL_MS = 5000;
const hasApi = "window" in globalThis && typeof fetch === "function";

/** One promise per in-flight dev-API call, held so it is never a floating promise; each removes itself on
 *  settle, so the set stays bounded by the number of concurrent calls. */
const inFlight = new Set<Promise<void>>();

/** Run an async task off the caller's path — without a floating promise or the `void` operator. The task
 *  owns its errors; its promise is held in `inFlight` and removes itself once it settles. */
function detach(make: () => Promise<void>): void {
  let marker: Promise<void> = Promise.resolve();
  marker = (async (): Promise<void> => {
    try {
      await make();
    } catch {
      // The task owns its errors; detaching only runs it to completion off the caller's path.
    } finally {
      inFlight.delete(marker);
    }
  })();
  inFlight.add(marker);
}

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
 *  failed fetch read as "Nothing here yet."). One shape for both the rows fetch and the issue-plan fetch. */
interface FetchResult<T> {
  readonly items: readonly T[];
  readonly ok: boolean;
}

/** GET `url` and parse its JSON, THROWING on a non-ok response so the caller's `catch` latches the failure
 *  (instead of a non-ok body being read as data) — the one place the `ok` check lives for both fetches. */
async function okJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`fetch ${url} failed: ${res.status}`);
  }
  return res.json();
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

const issues = reactive<IssueItem[]>([]) as IssueItem[];
let issuesLoaded = false;

/** The fetch state the issue views read to tell apart loading / failed / genuinely-empty — so the studio's
 *  first screen shows "Loading the plan…", "Couldn't reach GitHub", or "Nothing here yet." rather than a
 *  bare header. `loading` is on while a fetch is in flight; `error` latches when a fetch fails (non-ok /
 *  transport) and clears on the next success. */
const issuesState = reactive({ error: false, loading: false });

const events = reactive<EventItem[]>([]) as EventItem[];
let eventsLoaded = false;

/** The fetch state the event trace reads to distinguish loading / failed / genuinely-empty. Parallel to
 *  `issuesState`; `loading` is on while a fetch is in flight, `error` latches on a non-ok response. */
const eventsState = reactive({ error: false, loading: false });

/** Read + parse the issue plan from `/__vow/issues`, reporting `ok: false` (with an empty plan) on any
 *  non-ok response or transport failure. Entries are validated by `parseIssuePlan` (see `./issues.ts`),
 *  not blindly trusted. The same `{ ok, items }` shape the rows fetch uses. */
async function fetchIssues(): Promise<FetchResult<IssueItem>> {
  try {
    return { items: parseIssuePlan(await okJson(VOW_API.issues)), ok: true };
  } catch {
    return { items: [], ok: false };
  }
}

/** Read the event feed from `/__vow/events`, reporting `ok: false` on any non-ok response or failure. */
async function fetchEvents(): Promise<FetchResult<EventItem>> {
  try {
    return { items: parseEventFeed(await okJson(VOW_API.events)), ok: true };
  } catch {
    return { items: [], ok: false };
  }
}

/** Pull the event feed from `/__vow/events` and replace the shared array, driving `eventsState` so the
 *  trace can show a loading / error / empty branch. */
async function loadEvents(): Promise<void> {
  if (!hasApi) {
    return;
  }
  eventsState.loading = true;
  const result = await fetchEvents();
  eventsState.error = !result.ok;
  eventsState.loading = false;
  if (result.ok) {
    events.splice(0, events.length, ...result.items);
  }
}

/** Pull the issue plan from `/__vow/issues` (gh-direct) and replace the shared array (small, read-only),
 *  driving `issuesState` so the views can show a loading / error / empty branch. */
async function loadIssues(): Promise<void> {
  if (!hasApi) {
    return;
  }
  issuesState.loading = true;
  const result = await fetchIssues();
  issuesState.error = !result.ok;
  issuesState.loading = false;
  if (result.ok) {
    issues.splice(0, issues.length, ...result.items);
  }
}

/** Close or reopen an issue via `POST /__vow/issues` (the dev server shells the same `gh` the MCP does),
 *  then replace the shared plan with the fresh response. A failed write is swallowed; the poll reconciles. */
async function writeIssue(action: "close" | "reopen", issue: number): Promise<void> {
  if (!hasApi) {
    return;
  }
  try {
    const res = await fetch(VOW_API.issues, {
      body: JSON.stringify({ action, number: issue }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    if (res.ok) {
      issues.splice(0, issues.length, ...parseIssuePlan(await res.json()));
    }
  } catch {
    // Optimistic: the next freshness poll reconciles from /__vow/issues.
  }
}

/** Signal the agent to begin an issue via `POST /__vow/agent` (the dev server dispatches `vow agent run`).
 *  Status stays derived — the signal only kicks off the run; the resulting PR is what makes the issue read
 *  `doing` on the next poll, so nothing is spliced here. A failed signal is swallowed. */
async function signalStartWork(issue: number): Promise<void> {
  if (!hasApi) {
    return;
  }
  try {
    await fetch(VOW_API.agent, {
      body: JSON.stringify({ action: "start", number: issue }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
  } catch {
    // The agent run is fire-and-forget; the human watches it via the session link once the PR opens.
  }
}

let freshness = false;
/** Refetch every loaded collection on focus + a light visible-tab interval, so an MCP write shows up. */
function startFreshness(): void {
  if (freshness || !hasApi) {
    return;
  }
  freshness = true;
  const refresh = (): void => {
    if (document.hidden) {
      return;
    }
    for (const slug of collections.keys()) {
      detach(async () => {
        await load(slug);
      });
    }
    if (issuesLoaded) {
      detach(loadIssues);
    }
    if (eventsLoaded) {
      detach(loadEvents);
    }
  };
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

/** The shared reactive issue plan, read live from `/__vow/issues` (gh-direct) + polled on focus + the
 *  interval. `state` is the same `CollectionState` shape a collection exposes — its loading / error flags
 *  let a view show "Loading the plan…" or "Couldn't reach GitHub" instead of a bare header. `closeIssue`/
 *  `reopenIssue` POST back through the same dev seam the MCP uses — so the studio's action buttons and the
 *  agent share one path to GitHub. `startWork` POSTs the start-work signal to `/__vow/agent`, dispatching an
 *  agent session for the issue — the human's one trigger to begin. GitHub stays the source; the reply re-syncs. */
export function useIssues(): {
  closeIssue: (issue: number) => void;
  items: IssueItem[];
  reopenIssue: (issue: number) => void;
  startWork: (issue: number) => void;
  state: CollectionState;
} {
  if (!issuesLoaded) {
    issuesLoaded = true;
    detach(loadIssues);
    startFreshness();
  }
  return {
    closeIssue: (issue): void => {
      detach(async () => {
        await writeIssue("close", issue);
      });
    },
    items: issues,
    reopenIssue: (issue): void => {
      detach(async () => {
        await writeIssue("reopen", issue);
      });
    },
    startWork: (issue): void => {
      detach(async () => {
        await signalStartWork(issue);
      });
    },
    state: issuesState,
  };
}

/** The shared reactive event feed, read live from `/__vow/events` (the tailable append-only log) + polled
 *  on focus + the interval. `state` matches the `CollectionState` shape — its loading / error flags let a
 *  view show "Loading…" or "Couldn't load events" instead of a bare trace. Read-only: the feed is
 *  append-only and has no write seam in the browser. */
export function useEvents(): {
  items: EventItem[];
  state: CollectionState;
} {
  if (!eventsLoaded) {
    eventsLoaded = true;
    detach(loadEvents);
    startFreshness();
  }
  return { items: events, state: eventsState };
}

/** Create a stand-alone reactive row list — the in-place reconciliation surface, exported for tests and
 *  any caller that needs the store's identity-preserving reconcile without a DB-backed collection. */
export function createList(): ReactiveRows {
  return new ReactiveRows();
}
