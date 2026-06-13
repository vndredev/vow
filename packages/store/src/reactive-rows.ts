import { reactive } from "vue";

/**
 * The identity-preserving reactive row list and its public collection interface — extracted so
 * `index.ts` stays under the max-lines wall while the class stays self-contained (it has no
 * dependency on the fetch layer above it).
 */

type Maybe<T> = T | undefined;

/** A raw store row — a plain record with a mandatory string `id`. */
export type Row = Record<string, unknown> & { id: string };

/** The reactive fetch state a collection exposes — `loading` while its first/refresh fetch is in flight,
 *  `error` when the last fetch failed (non-ok / transport). The generated entity list reads it to tell a
 *  still-loading collection apart from a genuinely empty one (else "Nothing here yet." shows mid-fetch).
 *  Mirrors `IssuesState`; its reactive identity is preserved (the same instance every reader gets). */
export interface CollectionState {
  readonly error: boolean;
  readonly loading: boolean;
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
  /** The reactive loading / error state of this collection's fetch — the list branches on it to keep
   *  "Nothing here yet." off the screen while the first load is still in flight. */
  readonly state: CollectionState;
  /** Patch an item by id (optimistic; written through). */
  update(id: string, patch: Partial<T>): void;
}

/** Shallow row equality: same key set AND each key's value strictly equal. A dropped/added column changes
 *  the key set (so `tests/store.test.ts:75` keeps counting as a change), and a `Row`'s values are flat
 *  primitives, so `===` is exact — no deep walk needed. */
function sameRow(left: Readonly<Row>, right: Readonly<Row>): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  for (const key of leftKeys) {
    if (!Object.hasOwn(right, key) || left[key] !== right[key]) {
      return false;
    }
  }
  return true;
}

/** The outcome of patching/dropping ONE survivor row during a reconcile: which ids it consumed from the
 *  fresh set (so a duplicate is not re-appended) and whether the array actually moved (so a no-op poll skips
 *  the notify). */
interface PatchStep {
  readonly changed: boolean;
  readonly consumed: readonly string[];
}

/** The outcome of the whole survivor walk: every consumed id and whether any survivor patch/drop changed the
 *  array — reconcile ORs this with its appends to decide whether to notify. */
interface SurvivorResult {
  readonly changed: boolean;
  readonly consumed: ReadonlySet<string>;
}

/** A live, reactive `Row[]` that reconciles itself to fresh rows in place — keeping its array identity
 *  (relied on by `reference` dropdowns) and each surviving row's object identity (so Vue diffs minimally).
 *  Mutation lives on methods (`this`-bound), never on a parameter, so the rule wall holds throughout. */
export class ReactiveRows {
  /** The live reactive array — the same instance for every reader, so identity is shared. */
  public readonly rows: Row[] = reactive<Row[]>([]) as Row[];

  /** The collection's reactive fetch state — `loading` while `load` is in flight, `error` latched when the
   *  last fetch failed. Identity is shared (the same instance every reader gets), so a view destructuring it
   *  from `useCollection` keeps tracking it (like `rows`). Driven by `load`, mirroring `issuesState`. */
  public readonly state = reactive({ error: false, loading: false });

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
   *  the brand-new — so identity is preserved and Vue diffs minimally. Notifies ONLY when something actually
   *  differed (a patched value, a dropped row, an appended row): a 5s freshness poll that returns the live
   *  rows byte-for-byte leaves `getSnapshot()` unchanged and fires no listener (no reactivity churn). */
  public reconcile(fresh: readonly Readonly<Row>[]): void {
    const { changed: patched, consumed } = this.patchSurvivors(fresh);
    let appended = false;
    for (const row of fresh) {
      // Skip a pending id: an in-flight optimistic delete is not re-added from a still-stale fetch.
      if (!consumed.has(row.id) && !this.pending.has(row.id)) {
        this.rows.push({ ...row });
        appended = true;
      }
    }
    if (patched || appended) {
      this.notify();
    }
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
   *  return the set of ids that survived (so `reconcile` knows which `fresh` rows are brand-new) PLUS whether
   *  any survivor's patch or drop actually changed the array — so reconcile can skip a no-op notify. */
  private patchSurvivors(fresh: readonly Readonly<Row>[]): SurvivorResult {
    const byId = new Map(fresh.map((row) => [row.id, row]));
    const steps: PatchStep[] = [];
    for (let index = this.rows.length - 1; index >= 0; index -= 1) {
      const curId = this.rows.at(index)?.id ?? "";
      steps.push(this.patchOrDropAt(index, curId, byId.get(curId)));
    }
    const consumed = new Set<string>();
    for (const step of steps) {
      for (const id of step.consumed) {
        consumed.add(id);
      }
    }
    return { changed: steps.some((step) => step.changed), consumed };
  }

  /** Patch the row at `index` from `next` (consuming `next.id`), or drop it when `next` is absent (consuming
   *  nothing). The consumed list keeps the caller free of an `undefined` literal; `changed` reports whether the
   *  array actually moved (a real patch or a drop) so reconcile can skip a no-op notify. A pending id (an
   *  in-flight optimistic write) is left untouched — when `next` is present its keys are not overwritten (the
   *  update survives) and when `next` is absent the row is not dropped (the append survives) — and reports
   *  `changed: false`, but the id is still consumed so `reconcile` does not re-append a duplicate. */
  private patchOrDropAt(index: number, id: string, next: Maybe<Readonly<Row>>): PatchStep {
    if (this.pending.has(id)) {
      return { changed: false, consumed: [id] };
    }
    if (next) {
      return { changed: this.overwriteAt(index, next), consumed: [next.id] };
    }
    this.rows.splice(index, 1);
    return { changed: true, consumed: [] };
  }

  /** Overwrite the row at `index` with `fresh` in place — clear its own keys first so a column dropped
   *  upstream does not linger — keeping the row's identity. Returns whether anything actually differed
   *  (a value change OR a key-set change, e.g. a dropped column), so reconcile can skip a no-op notify on
   *  a byte-identical poll. A shallow compare is exact for a `Row` (flat string-keyed primitives). */
  private overwriteAt(index: number, fresh: Readonly<Row>): boolean {
    const target = this.rows.at(index);
    if (!target) {
      return false;
    }
    const differs = !sameRow(target, fresh);
    if (differs) {
      for (const key of Object.keys(target)) {
        Reflect.deleteProperty(target, key);
      }
      Object.assign(target, fresh);
    }
    return differs;
  }
}
