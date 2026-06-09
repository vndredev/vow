import { reactive } from "vue";

/**
 * @vow/store — the data adapter the generated views bind to. `useCollection(slug)` returns ONE shared
 * reactive array per entity slug (so a `reference` field reads another entity's items — the relation
 * dropdown). The array is backed by the local SQLite DB through the dev API (`/__vow/db/<slug>`; a Worker
 * over D1 in prod): the store loads it on first use, mutations write through, and it refetches on focus +
 * a light interval so an out-of-band write (the MCP/agent) shows up. The `useCollection` seam is
 * unchanged — only what's behind it (it was pure in-memory). Outside a browser (SSR / jsdom) it degrades
 * to a plain in-memory array (fetch is a no-op), so non-DOM imports stay safe.
 */

type Row = Record<string, unknown> & { id: string };

const collections = new Map<string, Row[]>();
const loaded = new Set<string>(); // slugs whose first fetch has been kicked off
const hasApi = typeof window !== "undefined" && typeof fetch === "function";
const BASE = "/__vow/db";

export interface Collection<T> {
  /** The shared reactive array of items for this slug. */
  readonly items: T[];
  /** Append an item (optimistic; written through to the DB). */
  append(item: T): void;
  /** Patch an item by id (optimistic; written through). */
  update(id: string, patch: Partial<T>): void;
  /** Remove the item at an index (optimistic; written through). */
  removeAt(index: number): void;
}

/** Reconcile the live array to the fetched rows by id — update in place, add new, drop missing — so Vue
 *  diffs minimally and the shared array identity (relied on by `reference` dropdowns) is preserved. */
function reconcile(items: Row[], rows: readonly Row[]): void {
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (let i = items.length - 1; i >= 0; i--) {
    const cur = items[i];
    if (!cur) continue;
    const fresh = byId.get(cur.id);
    if (fresh) {
      Object.assign(cur, fresh);
      byId.delete(cur.id);
    } else {
      items.splice(i, 1);
    }
  }
  for (const r of byId.values()) items.push(r);
}

/** Pull the slug's rows from the dev API and reconcile (a no-op outside a browser / with no server). */
function load(slug: string, items: Row[]): void {
  if (!hasApi) return;
  void fetch(`${BASE}/${slug}`)
    .then((res) => (res.ok ? (res.json() as Promise<Row[]>) : []))
    .then((rows) => reconcile(items, rows))
    .catch(() => undefined);
}

/** Fire-and-forget a write to the dev API — the optimistic local change already happened. */
function write(path: string, init: RequestInit): void {
  if (!hasApi) return;
  void fetch(`${BASE}/${path}`, { headers: { "content-type": "application/json" }, ...init }).catch(
    () => undefined,
  );
}

/** One issue on the plan — mirrors `@vow/observability`'s `PlanItem` (the `/__vow/issues` shape; kept
    local so the browser store pulls in no node code). */
export interface IssueItem {
  readonly issue: {
    readonly number: number;
    readonly title: string;
    readonly state: "open" | "closed";
    readonly labels: readonly string[];
    readonly assignees: readonly string[];
    readonly milestone?: { readonly title: string; readonly dueOn?: string };
  };
  readonly status: "planned" | "doing" | "done";
}

const issues = reactive<IssueItem[]>([]) as IssueItem[];
let issuesLoaded = false;

/** Pull the issue plan from `/__vow/issues` (gh-direct) and replace the shared array (small, read-only). */
function loadIssues(): void {
  if (!hasApi) return;
  void fetch("/__vow/issues")
    .then((res) => (res.ok ? (res.json() as Promise<IssueItem[]>) : []))
    .then((plan) => issues.splice(0, issues.length, ...plan))
    .catch(() => undefined);
}

let freshness = false;
/** Refetch every loaded collection on focus + a light visible-tab interval, so an MCP write shows up. */
function startFreshness(): void {
  if (freshness || !hasApi) return;
  freshness = true;
  const refresh = (): void => {
    if (document.hidden) return;
    for (const [slug, items] of collections) load(slug, items);
    if (issuesLoaded) loadIssues();
  };
  window.addEventListener("focus", refresh);
  document.addEventListener("visibilitychange", refresh);
  setInterval(refresh, 5000);
}

/** The shared reactive collection for an entity slug — same array for every caller; DB-backed. */
export function useCollection<T>(slug: string): Collection<T> {
  let items = collections.get(slug);
  if (!items) {
    items = reactive<Row[]>([]) as Row[];
    collections.set(slug, items);
  }
  const rows = items;
  if (!loaded.has(slug)) {
    loaded.add(slug);
    load(slug, rows);
    startFreshness();
  }
  return {
    items: rows as unknown as T[],
    append: (item) => {
      rows.push(item as unknown as Row);
      write(slug, { method: "POST", body: JSON.stringify(item) });
    },
    update: (id, patch) => {
      const it = rows.find((r) => r.id === id);
      if (it) Object.assign(it, patch);
      write(`${slug}/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
    },
    removeAt: (index) => {
      const id = rows[index]?.id;
      rows.splice(index, 1);
      if (id !== undefined) write(`${slug}/${id}`, { method: "DELETE" });
    },
  };
}

/** The shared reactive issue plan, read live from `/__vow/issues` (gh-direct) + polled on focus + the
 *  interval — so the agent's MCP writes to GitHub show up. Read-only here; GitHub is the source. */
export function useIssues(): { items: IssueItem[] } {
  if (!issuesLoaded) {
    issuesLoaded = true;
    loadIssues();
    startFreshness();
  }
  return { items: issues };
}
