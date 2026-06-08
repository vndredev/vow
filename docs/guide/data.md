---
group: Reference
order: 2
---

# Data

`@vow/store` is vow's data layer — a shared, reactive **collection per entity slug**, backed by a local **SQLite DB**. Every generated view that lists the same entity reads **one array**, so a `reference` field can resolve another entity's items.

## `useCollection`

```ts
const { items, append, removeAt } = useCollection<Task>("task");
```

`items` is a reactive array (the same one for every caller of the slug); `append` / `removeAt` mutate it. The generated entity list, its create form, and a `reference` dropdown all call `useCollection` for the same slug — so adding a user on the Team page makes it selectable as a task's `assignee` on another, and the list resolves the stored id to the user's **name** (see [referent-display](/guide/emit)).

## The seam

`useCollection` is the **data-adapter seam** — now backed by a **local SQLite DB** (`@vow/db`, `node:sqlite`). The store loads each collection from the dev API (`/__vow/db/<slug>`) on first use, writes mutations through (`append` · `update` · `removeAt`), and refetches on focus + a light interval so an out-of-band write (the agent) shows up. Records persist across reloads in `.vow/data.db` (gitignored), seeded once from each entity's `## seed`. The generated views don't change — only what's behind the seam does. In prod the **same `/__vow/db` routes** are served by a Worker over **Cloudflare D1** (D1 is SQLite), so a vow app is byte-identical local ↔ hosted.

## Routing

`@vow/router` is the matching runtime piece — a tiny client router. The generated boot builds one routes table (the root page, plus every non-root view and form at `/<slug>`) and mounts the match inside the [app shell](/guide/shell); internal links navigate without a full reload.
