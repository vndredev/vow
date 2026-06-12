import { VOW_API, dbPath } from "@vow/db/routes";
import { isObject } from "./guards.ts";
import { parseIssuePlan } from "./issues.ts";
import { reactive } from "vue";

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

/** A value that may be absent — used in return positions; presence is checked by truthiness or a `typeof`
 *  guard at the use site (every object here is non-null, so a truthy check is exact and avoids `undefined`). */
type Maybe<T> = T | undefined;

/** The validated issue-plan item (the public `@vow/store` type generated views bind to), derived from the
 *  parser in `./issues.ts` so the type tracks the runtime shape exactly. */
export type IssueItem = ReturnType<typeof parseIssuePlan>[number];

type Row = Record<string, unknown> & { id: string };

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

export interface Collection<T> {
  /** Append an item (optimistic; written through to the DB). */
  append(item: T): void;
  /** The shared reactive array of items for this slug. */
  readonly items: T[];
  /** Remove the item at an index (optimistic; written through). */
  removeAt(index: number): void;
  /** Remove the item carrying `id` (optimistic; written through). The id-keyed delete the generated
   *  list uses — it loops over filtered/sorted/grouped items, so the displayed index is not the store
   *  index; deleting by id removes the right row regardless of slice/order. */
  removeById(id: string): void;
  /** Patch an item by id (optimistic; written through). */
  update(id: string, patch: Partial<T>): void;
}

/** A live, reactive `Row[]` that reconciles itself to fresh rows in place — keeping its array identity
 *  (relied on by `reference` dropdowns) and each surviving row's object identity (so Vue diffs minimally).
 *  Mutation lives on methods (`this`-bound), never on a parameter, so the rule wall holds throughout. */
export class ReactiveRows {
  /** The live reactive array — the same instance for every reader, so identity is shared. */
  public readonly rows: Row[] = reactive<Row[]>([]) as Row[];

  /** Listeners notified after every mutation — the framework-neutral seam non-Vue bindings (React's
   *  useSyncExternalStore, a Solid signal) subscribe to. Vue tracks `rows` directly and ignores this. */
  private readonly listeners = new Set<() => void>();

  /** A monotonically-rising snapshot token, bumped on every mutation. A binding reads it to know the store
   *  changed — an in-place array mutation keeps the same reference, so the snapshot is this primitive, not
   *  the array (what React's useSyncExternalStore compares, what a Solid signal tracks). */
  private revision = 0;

  /** Ids with an optimistic write in flight to the server. A freshness poll landing in this window would
   *  reconcile against still-stale DB rows and revert the user's action on screen (a flicker); reconcile
   *  skips a pending id for all three kinds — an update is not overwritten, an appended row not yet in the
   *  fetch is not dropped, a deleted row not yet gone from the fetch is not re-added. Cleared on write settle. */
  private readonly pending = new Set<string>();

  /** The current snapshot token — rises on every mutation. The stable getSnapshot value for a binding. */
  public get version(): number {
    return this.revision;
  }

  /** Subscribe to mutations; returns the unsubscribe. The neutral observer seam for the #101 adapters.
   *  This is the `subscribe` half of React's `useSyncExternalStore(subscribe, getSnapshot)` and what a Solid
   *  signal re-reads from — framework-free (a plain listener `Set`), so no framework is imported here. */
  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** The current snapshot — the `getSnapshot` half of `useSyncExternalStore(subscribe, getSnapshot)`. It is
   *  the rising revision token (a number), so it is **referentially stable between mutations**: repeated calls
   *  with no mutation in between return the identical primitive, which is the invariant `useSyncExternalStore`
   *  requires (an unstable snapshot loops React forever). The store mutates its `rows` in place to keep array +
   *  row identity (the `reference` dropdowns rely on it), so this token — not the array — is what changes on a
   *  mutation; a binding reads the token to know to re-pull `rows`. Pairs with `subscribe` above; same value as
   *  `version`, named for the framework contract. */
  public getSnapshot(): number {
    return this.revision;
  }

  /** Mark `id` as having an optimistic write in flight, so the freshness poll skips it until the write
   *  settles (the write-through layer calls this when it fires the PATCH/POST/DELETE). */
  public markPending(id: string): void {
    this.pending.add(id);
  }

  /** Clear `id`'s in-flight mark once its write settles, so the next poll reconciles it normally (the
   *  write-through layer calls this in the optimistic write's `finally`). */
  public clearPending(id: string): void {
    this.pending.delete(id);
  }

  /** Bump the snapshot token, then fire every subscribed listener — called after each mutation below. */
  private notify(): void {
    this.revision += 1;
    for (const listener of this.listeners) {
      listener();
    }
  }

  /** Append an already-validated row (a fresh, mutable copy so later in-place patches are safe). */
  public push(row: Readonly<Row>): void {
    this.rows.push({ ...row });
    this.notify();
  }

  /** Reconcile the live array to `fresh` by id — patch each survivor in place, drop the missing, append
   *  the brand-new — so identity is preserved and Vue diffs minimally. */
  public reconcile(fresh: readonly Readonly<Row>[]): void {
    const consumed = this.patchSurvivors(fresh);
    for (const row of fresh) {
      // Skip a pending id: an in-flight optimistic delete is not re-added from a still-stale fetch.
      if (!consumed.has(row.id) && !this.pending.has(row.id)) {
        this.rows.push({ ...row });
      }
    }
    this.notify();
  }

  /** Remove the row at `index` in place; returns its id (or `undefined` when the slot was empty). */
  public removeAt(index: number): Maybe<string> {
    const id = this.rows.at(index)?.id;
    this.rows.splice(index, 1);
    this.notify();
    return id;
  }

  /** Remove the row carrying `id` in place; returns the id when a row matched (so the write-through fires),
   *  else an absent id (a no-op). The id is resolved to the live store index HERE, so a caller looping over a
   *  filtered/sorted/grouped view deletes the right row, never the displayed position. The matching index is
   *  collected into a one-or-zero list, then spliced through `removeAt` — keeping the absent case off any
   *  `undefined` literal (the `patchOrDropAt` precedent). */
  public removeById(id: string): Maybe<string> {
    const at: number[] = [];
    for (const [index, row] of this.rows.entries()) {
      if (row.id === id) {
        at.push(index);
      }
    }
    return at.map((index) => this.removeAt(index)).at(0);
  }

  /** Patch the row carrying `id` in place; a no-op when no row matches. */
  public update(id: string, patch: Readonly<Record<string, unknown>>): void {
    const cur = this.rows.find((row: Readonly<Row>) => row.id === id);
    if (cur) {
      Object.assign(cur, patch);
      this.notify();
    }
  }

  /** Walk the live array high-to-low: patch each survivor in place, drop every row whose id is gone, and
   *  return the set of ids that survived (so `reconcile` knows which `fresh` rows are brand-new). */
  private patchSurvivors(fresh: readonly Readonly<Row>[]): ReadonlySet<string> {
    const byId = new Map(fresh.map((row) => [row.id, row]));
    const consumed = new Set<string>();
    for (let index = this.rows.length - 1; index >= 0; index -= 1) {
      const curId = this.rows.at(index)?.id ?? "";
      for (const kept of this.patchOrDropAt(index, curId, byId.get(curId))) {
        consumed.add(kept);
      }
    }
    return consumed;
  }

  /** Patch the row at `index` from `next` (returning `[next.id]`), or drop it when `next` is absent
   *  (returning `[]`). The single-element-list result keeps the caller free of an `undefined` literal.
   *  A pending id (an in-flight optimistic write) is left untouched: when `next` is present its keys are not
   *  overwritten (the update survives) and when `next` is absent the row is not dropped (the append survives),
   *  but the id is still reported consumed so `reconcile` does not re-append a duplicate. */
  private patchOrDropAt(index: number, id: string, next: Maybe<Readonly<Row>>): string[] {
    if (this.pending.has(id)) {
      return [id];
    }
    if (next) {
      this.overwriteAt(index, next);
      return [next.id];
    }
    this.rows.splice(index, 1);
    return [];
  }

  /** Overwrite the row at `index` with `fresh` in place — clear its own keys first so a column dropped
   *  upstream does not linger — keeping the row's identity. */
  private overwriteAt(index: number, fresh: Readonly<Row>): void {
    const target = this.rows.at(index);
    if (target) {
      for (const key of Object.keys(target)) {
        Reflect.deleteProperty(target, key);
      }
      Object.assign(target, fresh);
    }
  }
}

const collections = new Map<string, ReactiveRows>();
// Slugs whose first fetch has been kicked off.
const loaded = new Set<string>();

/** Read a slug's rows from the dev API, returning `[]` on any non-ok response or transport failure. */
async function fetchRows(slug: string): Promise<Row[]> {
  try {
    const res = await fetch(dbPath(slug));
    if (!res.ok) {
      return [];
    }
    return toRows(await res.json());
  } catch {
    return [];
  }
}

/** Pull a slug's rows from the dev API into its collection (a no-op outside a browser / with no server,
 *  or when the slug has no live collection yet). Resolves the list from `collections` so no instance is
 *  passed in — the rule wall forbids a mutable class-instance parameter. */
async function load(slug: string): Promise<void> {
  if (!hasApi) {
    return;
  }
  const rows = await fetchRows(slug);
  collections.get(slug)?.reconcile(rows);
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

/** The outcome of one issue-plan fetch — `ok` is false on a non-ok response or transport failure, so the
 *  caller can latch the error flag rather than swallow it (the old `[]` hid a failure as an empty plan). */
interface IssuesResult {
  readonly ok: boolean;
  readonly plan: readonly IssueItem[];
}

/** Read + parse the issue plan from `/__vow/issues`, reporting `ok: false` (with an empty plan) on any
 *  non-ok response or transport failure. Entries are validated by `parseIssuePlan` (see `./issues.ts`),
 *  not blindly trusted. */
async function fetchIssues(): Promise<IssuesResult> {
  try {
    const res = await fetch(VOW_API.issues);
    if (!res.ok) {
      return { ok: false, plan: [] };
    }
    return { ok: true, plan: parseIssuePlan(await res.json()) };
  } catch {
    return { ok: false, plan: [] };
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
    issues.splice(0, issues.length, ...result.plan);
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
  };
  globalThis.addEventListener("focus", refresh);
  document.addEventListener("visibilitychange", refresh);
  setInterval(refresh, REFRESH_INTERVAL_MS);
}

/** Resolve (creating on first use) the live reactive row list for a slug, kicking off its first load. */
function listFor(slug: string): ReactiveRows {
  const existing = collections.get(slug);
  if (existing) {
    return existing;
  }
  const created = new ReactiveRows();
  collections.set(slug, created);
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

/** The shared reactive collection for an entity slug — same array for every caller; DB-backed. */
export function useCollection<T>(slug: string): Collection<T> {
  const list = listFor(slug);
  if (!loaded.has(slug)) {
    loaded.add(slug);
    detach(async () => {
      await load(slug);
    });
    startFreshness();
  }
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
    update: (id, patch): void => {
      list.update(id, patch);
      writeThrough(slug, id, async () => {
        await write(dbPath(slug, id), "PATCH", JSON.stringify(patch));
      });
    },
  };
}

/** The reactive fetch state the issue views read — `loading` while a fetch is in flight, `error` when the
 *  last fetch failed. Its reactive identity is preserved (the same instance every reader gets), so a view
 *  destructuring it from `useIssues` keeps tracking it (like `items`). */
export interface IssuesState {
  readonly error: boolean;
  readonly loading: boolean;
}

/** The shared reactive issue plan, read live from `/__vow/issues` (gh-direct) + polled on focus + the
 *  interval. `state` carries the loading / error flags so a view can show "Loading the plan…" or "Couldn't
 *  reach GitHub" instead of a bare header. `closeIssue`/`reopenIssue` POST back through the same dev seam
 *  the MCP uses — so the studio's action buttons and the agent share one path to GitHub. `startWork` POSTs
 *  the start-work signal to `/__vow/agent`, dispatching an agent session for the issue — the human's one
 *  trigger to begin. GitHub stays the source; the reply re-syncs. */
export function useIssues(): {
  closeIssue: (issue: number) => void;
  items: IssueItem[];
  reopenIssue: (issue: number) => void;
  startWork: (issue: number) => void;
  state: IssuesState;
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

/** Create a stand-alone reactive row list — the in-place reconciliation surface, exported for tests and
 *  any caller that needs the store's identity-preserving reconcile without a DB-backed collection. */
export function createList(): ReactiveRows {
  return new ReactiveRows();
}
