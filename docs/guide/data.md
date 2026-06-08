---
group: Reference
order: 2
---

# Data

`@vow/store` is vow's data layer — a shared, reactive **in-memory collection per entity slug**. Every generated view that lists the same entity reads **one array**, so a `reference` field can resolve another entity's items.

## `useCollection`

```ts
const { items, append, removeAt } = useCollection<Task>("task");
```

`items` is a reactive array (the same one for every caller of the slug); `append` / `removeAt` mutate it. The generated entity list, its create form, and a `reference` dropdown all call `useCollection` for the same slug — so adding a user on the Team page makes it selectable as a task's `assignee` on another, and the list resolves the stored id to the user's **name** (see [referent-display](/guide/emit)).

## The seam

`useCollection` is the **data-adapter seam**. Today it's in-memory — state lives for the session. The same signature backs the planned **Cloudflare D1** adapter for real persistence (see the [roadmap](/guide/roadmap)): views don't change, only what's behind the seam does.

## Routing

`@vow/router` is the matching runtime piece — a tiny client router. The generated boot builds one routes table (the root page, plus every non-root view and form at `/<slug>`) and mounts the match inside the [app shell](/guide/shell); internal links navigate without a full reload.
