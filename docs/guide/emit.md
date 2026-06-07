---
group: Fulfilment
order: 0
---

# emit — generated

An `emit` vow is generated deterministically into `.generated/` and verified by the compiler. You declare; vow produces. There are two `emit` targets today: **entity** and **view**.

## emit entity

```markdown
---
id: vow_task
fulfills: emit entity
---

# A task someone must do

## fields

- title: text, required
- done: boolean
```

→ two files in `.generated/` — a **pure model**, no UI:

- **`task.ts`** — a `Task` interface + a validating `createTask` factory (a missing required field throws). Every entity also gets a stable auto-`id` (the factory generates it) — the identity a `reference` points at.
- **`task.test.ts`** — a Vitest suite **derived from the fields** (a happy path + one reject per required field). No one writes it; the test names _are_ the proven scenarios (see [proof](/guide/proof)).

**Field types:** `text` · `number` · `boolean` · `date` (an ISO-8601 string, rendered as a native date input) · `select(a|b|c)` (a string-literal union, rendered as a `<select>`) · `reference(entity)` (the target entity's id — typed as `string`). Full relations (resolving the referent, a dropdown of its items) are on the [roadmap](/guide/roadmap).

An entity is **data, not a screen** — it never renders by itself. To put it on the page, a view lists it.

## emit view

A view is a page: a **`## view`** block — a YAML list of components (semantic blocks, layout primitives, text). It's the one view path; the full catalog is in [Views](/guide/layout). A view that renders an entity's CRUD list references it by slug with `list:`:

```markdown
---
id: vow_home
fulfills: emit view
root: true
---

# Home
```

with the page's components under `## view`:

```yaml
- h2: Your tasks
- list: task
```

→ a `.vue` for the page and — **because the view asked for it** — the entity's CRUD list (`Task.vue`): read · create (inline form) · toggle · delete on local state. Boolean fields become the emitted, accessible [`<Checkbox>`](/guide/primitives). No `list:`, no list — the entity stays a pure model.

Next: [bind →](/guide/bind)
