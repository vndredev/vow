---
group: Reference
order: 2
---

# Data

`@vow/store` is vow's data layer — a shared, reactive **in-memory collection per entity slug** that reads **through to `@vow/db`** (the dev API today, Cloudflare D1 in prod). Every generated view that lists the same entity reads **one array**, so a `reference` field can resolve another entity's items.

## `useCollection`

```ts
const { items, append, removeAt, removeById } = useCollection<Task>("task");
```

`items` is a reactive array (the same one for every caller of the slug); `append` / `update` / `removeAt` / `removeById` write through to the DB. **`removeById(id)`** deletes by the row's id (resolved to the live store index inside the store) — what the generated list's [opt-in delete](/guide/views#row-actions) uses, since it loops over a filtered/sorted/grouped view where the displayed index is not the store index. The generated entity list (read-only by default) and a `reference` cell both call `useCollection` for the same slug — so a user the agent adds is selectable as a task's `assignee`, and the list resolves the stored id to the user's **name** (see [referent-display](/guide/emit)).

## The seam

`useCollection` is the **data-adapter seam** — now backed by a **local SQLite DB** (`@vow/db`, `node:sqlite`). The store loads each collection from the dev API (`/__vow/db/<slug>`) on first use, writes mutations through (`append` · `update` · `removeAt` · `removeById`), and refetches on focus + a light interval so an out-of-band write (the agent) shows up. Records persist across reloads in `.vow/data.db` (gitignored), seeded once from each entity's `## seed`. The generated views don't change — only what's behind the seam does. In prod the **same `/__vow/db` routes** are served by a Worker over **Cloudflare D1** (D1 is SQLite), so a vow app is byte-identical local ↔ hosted.

## The framework-neutral reactive core

Behind `useCollection` sits **`ReactiveRows`** — a live row list that mutates **in place** (so the array's identity and each surviving row's identity are preserved, which the `reference` dropdowns rely on). Vue tracks that array directly through `reactive`. To make a generated component work across frameworks (the React/Solid adapters of [the component model](/guide/components)), the same collection exposes a **framework-neutral observer seam** — no framework is imported to use it:

```ts
// React: bind the neutral seam to useSyncExternalStore.
const version = useSyncExternalStore(
  (cb) => list.subscribe(cb), // fires on every mutation
  () => list.getSnapshot(), // a rising token, stable between mutations
);
// then read list.rows (its array identity is preserved across mutations)
```

- **`subscribe(listener) -> unsubscribe`** — registers a plain listener fired after **every** mutation kind (append, reconcile, update, delete-by-id, delete-by-index); the return value unsubscribes.
- **`getSnapshot()`** (alias `version`) — a monotonically rising number, the `useSyncExternalStore` snapshot. Because the rows mutate **in place**, the array reference never changes; this token is what moves on a mutation, so a binding compares it. It is **referentially stable between mutations** — repeated reads with nothing in between return the identical value, the invariant `useSyncExternalStore` requires (an unstable snapshot loops React forever). A Solid signal tracks it the same way.

This is the **store half** of multi-framework support: the data layer is framework-ready and Vue's `reactive` path is untouched. The remaining (deliberate) half is the **emitter** translating a component's setup into each framework's idiom — see [the component model](/guide/components).

## Routing

`@vow/router` is the matching runtime piece — a tiny client router. The generated boot builds one routes table (the root page, plus every non-root view and form at `/<slug>`) and mounts the match inside the [app shell](/guide/shell); internal links navigate without a full reload.
